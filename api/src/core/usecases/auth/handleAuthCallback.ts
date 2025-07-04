// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Session, SessionRepository } from "../../ports/DbApiV2";
import { OidcParams } from "./initiateAuth";

type HandleAuthCallbackDependencies = {
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

export type HandleAuthCallback = Awaited<ReturnType<typeof makeHandleAuthCallback>>;
export const makeHandleAuthCallback = async ({ sessionRepository, oidcParams }: HandleAuthCallbackDependencies) => {
    // Fetch OIDC configuration once at startup
    const oidcConfig = await getOidcConfiguration(oidcParams.issuerUri);

    return async ({ code, state }: HandleAuthCallbackParams): Promise<Session | null> => {
        // Find session by state
        const session = await sessionRepository.findByState(state);

        if (!session) {
            console.error("Session not found for state:", state);
            return null;
        }

        try {
            // Exchange code for tokens
            const tokens = await exchangeCodeForTokens(code, oidcParams, oidcConfig);

            // Get user info
            const userInfo = await getUserInfo(tokens.access_token, oidcConfig);

            // Update session with user info and tokens
            return await sessionRepository.updateWithUserInfo({
                sessionId: session.id,
                userId: userInfo.sub,
                email: userInfo.email,
                sub: userInfo.sub,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined
            });
        } catch (error) {
            console.error("Error during OIDC callback:", error);
            return null;
        }
    };
};

async function exchangeCodeForTokens(
    code: string,
    oidcParams: OidcParams,
    oidcConfig: any
): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
}> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri(),
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

async function getUserInfo(accessToken: string, oidcConfig: any): Promise<OidcUserInfo> {
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

async function getOidcConfiguration(issuerUri: string): Promise<any> {
    const configUrl = `${issuerUri}/.well-known/openid-configuration`;
    const response = await fetch(configUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
    }

    return response.json();
}

function getRedirectUri(): string {
    // This should be configurable based on your deployment
    // For now, assuming it's the same host as the API
    return `${process.env.API_BASE_URL || "http://localhost:8080"}/auth/callback`;
}
