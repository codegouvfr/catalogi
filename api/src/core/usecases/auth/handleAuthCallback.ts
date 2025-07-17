// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Session, SessionRepository, UserRepository } from "../../ports/DbApiV2";
import { getAuthRedirectUri } from "./auth.helpers";
import { OidcParams } from "./initiateAuth";

type HandleAuthCallbackDependencies = {
    userRepository: UserRepository;
    sessionRepository: SessionRepository;
    oidcParams: OidcParams;
};

type HandleAuthCallbackParams = {
    code: string;
    state: string;
};

export type OidcUserInfo = {
    sub: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
};

type OidcConfiguration = {
    token_endpoint: string;
    userinfo_endpoint: string;
};

export type HandleAuthCallback = Awaited<ReturnType<typeof makeHandleAuthCallback>>;
export const makeHandleAuthCallback = async ({
    sessionRepository,
    userRepository,
    oidcParams
}: HandleAuthCallbackDependencies) => {
    // Fetch OIDC configuration once at startup
    const oidcConfig = await getOidcConfiguration(oidcParams.issuerUri);

    return async ({ code, state }: HandleAuthCallbackParams): Promise<Session> => {
        // Find session by state
        const initialSession = await sessionRepository.findByState(state);

        if (!initialSession) {
            throw new Error(`Session not found for state : ${state}`);
        }

        const tokens = await exchangeCodeForTokens(code, oidcParams, oidcConfig);

        const userInfoFromProvider = await getUserInfoFromProvider(tokens.access_token, oidcConfig);

        let userId: number;
        const user =
            (await userRepository.getBySub(userInfoFromProvider.sub)) ??
            (await userRepository.getByEmail(userInfoFromProvider.email));

        if (!user) {
            userId = await userRepository.add({
                sub: userInfoFromProvider.sub,
                email: userInfoFromProvider.email,
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
                email: userInfoFromProvider.email
            });
        }

        const updatedSession: Session = {
            ...initialSession,
            userId,
            email: userInfoFromProvider.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? null,
            expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null
        };

        await sessionRepository.updateWithUserInfo(updatedSession);

        return updatedSession;
    };
};

async function exchangeCodeForTokens(
    code: string,
    oidcParams: OidcParams,
    oidcConfig: OidcConfiguration
): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
}> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getAuthRedirectUri(),
        client_id: oidcParams.clientId,
        client_secret: oidcParams.clientSecret
    });

    const response = await fetch(oidcConfig.token_endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
    });

    if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return response.json();
}

async function getUserInfoFromProvider(accessToken: string, oidcConfig: any): Promise<OidcUserInfo> {
    const response = await fetch(oidcConfig.userinfo_endpoint, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return response.json();
}

async function getOidcConfiguration(issuerUri: string): Promise<OidcConfiguration> {
    const configUrl = `${issuerUri}/.well-known/openid-configuration`;
    const response = await fetch(configUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
    }

    return response.json();
}
