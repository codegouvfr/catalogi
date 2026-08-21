// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Session, SessionRepository, UserRepository } from "../../ports/DbApiV2";
import { OidcClient } from "./oidcClient";

// Default session duration when OIDC provider doesn't provide expires_in
export const DEFAULT_SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

type HandleAuthCallbackDependencies = {
    userRepository: UserRepository;
    sessionRepository: SessionRepository;
    oidcClient: OidcClient;
    initialAdminEmail?: string;
};

type HandleAuthCallbackParams = {
    code: string;
    state: string;
};

export type HandleAuthCallback = Awaited<ReturnType<typeof makeHandleAuthCallback>>;
export const makeHandleAuthCallback = ({
    sessionRepository,
    userRepository,
    oidcClient,
    initialAdminEmail
}: HandleAuthCallbackDependencies) => {
    return async ({ code, state }: HandleAuthCallbackParams): Promise<Session> => {
        // Find session by state
        const initialSession = await sessionRepository.findByState(state);

        if (!initialSession) {
            throw new Error(`Session not found for state : ${state}`);
        }

        const tokens = await oidcClient.exchangeCodeForTokens(code);

        const userInfoFromProvider = await oidcClient.getUserInfo(tokens.access_token);

        const matchesInitialAdmin =
            initialAdminEmail !== undefined &&
            initialAdminEmail.trim().toLowerCase() === userInfoFromProvider.email.trim().toLowerCase();

        const saveUser = async (repository: UserRepository): Promise<number> => {
            const user =
                (await repository.getBySub(userInfoFromProvider.sub)) ??
                (await repository.getByEmail(userInfoFromProvider.email));
            const shouldBootstrapAdmin = matchesInitialAdmin && !(await repository.hasAdmin());
            const role = shouldBootstrapAdmin ? "admin" : (user?.role ?? "user");

            if (!user) {
                return repository.add({
                    sub: userInfoFromProvider.sub,
                    email: userInfoFromProvider.email,
                    firstName: userInfoFromProvider.given_name,
                    lastName: userInfoFromProvider.family_name ?? userInfoFromProvider.usual_name,
                    organization: null,
                    isPublic: false,
                    about: undefined,
                    role
                });
            }

            await repository.update({
                ...user,
                sub: userInfoFromProvider.sub,
                email: userInfoFromProvider.email,
                firstName: userInfoFromProvider.given_name,
                lastName: userInfoFromProvider.family_name ?? userInfoFromProvider.usual_name,
                role
            });

            return user.id;
        };

        const userId = matchesInitialAdmin
            ? await userRepository.runExclusiveForInitialAdmin(saveUser)
            : await saveUser(userRepository);

        // Use OIDC provider's expires_in, defaulting if not provided
        const sessionDurationMs = tokens.expires_in ? tokens.expires_in * 1000 : DEFAULT_SESSION_DURATION_MS;

        const expiresAt = new Date(Date.now() + sessionDurationMs);

        const updatedSession: Session = {
            ...initialSession,
            userId,
            email: userInfoFromProvider.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? null,
            idToken: tokens.id_token ?? null,
            expiresAt
        };

        await sessionRepository.update(updatedSession);

        return updatedSession;
    };
};
