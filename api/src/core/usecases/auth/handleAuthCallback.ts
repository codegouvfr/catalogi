// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Session, SessionRepository, UserRepository } from "../../ports/DbApiV2";
import { OidcClient } from "./oidcClient";

export const MIN_SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour

type HandleAuthCallbackDependencies = {
    userRepository: UserRepository;
    sessionRepository: SessionRepository;
    oidcClient: OidcClient;
};

type HandleAuthCallbackParams = {
    code: string;
    state: string;
};

export type HandleAuthCallback = Awaited<ReturnType<typeof makeHandleAuthCallback>>;
export const makeHandleAuthCallback = ({
    sessionRepository,
    userRepository,
    oidcClient
}: HandleAuthCallbackDependencies) => {
    return async ({ code, state }: HandleAuthCallbackParams): Promise<Session> => {
        // Find session by state
        const initialSession = await sessionRepository.findByState(state);

        if (!initialSession) {
            throw new Error(`Session not found for state : ${state}`);
        }

        const tokens = await oidcClient.exchangeCodeForTokens(code);
        // console.log("🔍 OIDC tokens received:", {
        //     expires_in: tokens.expires_in,
        //     has_refresh_token: !!tokens.refresh_token,
        //     has_id_token: !!tokens.id_token
        // });

        const userInfoFromProvider = await oidcClient.getUserInfo(tokens.access_token);

        let userId: number;
        const user =
            (await userRepository.getBySub(userInfoFromProvider.sub)) ??
            (await userRepository.getByEmail(userInfoFromProvider.email));

        if (!user) {
            userId = await userRepository.add({
                sub: userInfoFromProvider.sub,
                email: userInfoFromProvider.email,
                firstName: userInfoFromProvider.given_name,
                lastName: userInfoFromProvider.family_name ?? userInfoFromProvider.usual_name,
                organization: null,
                isPublic: false,
                about: undefined
            });
        } else {
            userId = user.id;
            await userRepository.update({
                ...user,
                id: userId,
                sub: userInfoFromProvider.sub,
                email: userInfoFromProvider.email,
                firstName: userInfoFromProvider.given_name,
                lastName: userInfoFromProvider.family_name ?? userInfoFromProvider.usual_name
            });
        }

        // Use minimum session duration or default if OIDC doesn't provide expires_in
        const sessionDurationMs = tokens.expires_in
            ? Math.max(tokens.expires_in * 1000, MIN_SESSION_DURATION_MS)
            : MIN_SESSION_DURATION_MS;

        console.log("🔍 Session duration:", sessionDurationMs / 1000 / 60, "minutes");

        const updatedSession: Session = {
            ...initialSession,
            userId,
            email: userInfoFromProvider.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? null,
            idToken: tokens.id_token ?? null,
            expiresAt: new Date(Date.now() + sessionDurationMs)
        };

        await sessionRepository.update(updatedSession);

        return updatedSession;
    };
};
