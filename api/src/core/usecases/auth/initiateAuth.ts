// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import crypto from "crypto";
import { SessionRepository } from "../../ports/DbApiV2";

export type OidcParams = {
    issuerUri: string;
    clientId: string;
    clientSecret: string;
};

type InitiateAuthDependencies = {
    sessionRepository: SessionRepository;
    oidcParams: OidcParams;
};

type InitiateAuthParams = {
    redirectUrl?: string;
};

export type InitiateAuth = Awaited<ReturnType<typeof makeInitiateAuth>>;
export const makeInitiateAuth = async ({ sessionRepository, oidcParams }: InitiateAuthDependencies) => {
    const authEndpoint = await getOidcAuthEndpoint(oidcParams.issuerUri);

    return async ({ redirectUrl }: InitiateAuthParams) => {
        const sessionId = crypto.randomUUID();
        const state = crypto.randomBytes(32).toString("hex");

        await sessionRepository.create({
            id: sessionId,
            state,
            redirectUrl: redirectUrl || null
        });

        const authUrl = new URL(authEndpoint);
        authUrl.search = new URLSearchParams({
            response_type: "code",
            client_id: oidcParams.clientId,
            redirect_uri: getRedirectUri(),
            state: state
        }).toString();

        return { sessionId, authUrl: authUrl.toString() };
    };
};

async function getOidcAuthEndpoint(issuerUri: string): Promise<string> {
    const configUrl = `${issuerUri}/.well-known/openid-configuration`;
    const response = await fetch(configUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
    }

    const { authorization_endpoint } = await response.json();

    return authorization_endpoint;
}

function getRedirectUri(): string {
    // This should be configurable based on your deployment
    // For now, assuming it's the same host as the API
    return `${process.env.API_BASE_URL || "http://localhost:8080"}/auth/callback`;
}
