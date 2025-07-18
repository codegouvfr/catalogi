// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import crypto from "crypto";
import { SessionRepository } from "../../ports/DbApiV2";
import { OidcClient } from "./oidcClient";

type InitiateAuthDependencies = {
    sessionRepository: SessionRepository;
    oidcClient: OidcClient;
};

type InitiateAuthParams = {
    redirectUrl?: string;
};

export type InitiateAuth = Awaited<ReturnType<typeof makeInitiateAuth>>;
export const makeInitiateAuth = ({ sessionRepository, oidcClient }: InitiateAuthDependencies) => {
    return async ({ redirectUrl }: InitiateAuthParams) => {
        const sessionId = crypto.randomUUID();
        const state = crypto.randomBytes(32).toString("hex");

        await sessionRepository.create({
            id: sessionId,
            state,
            redirectUrl: redirectUrl || null
        });

        const authUrl = new URL(oidcClient.getAuthorizationEndpoint());
        authUrl.search = new URLSearchParams({
            response_type: "code",
            client_id: oidcClient.clientId,
            redirect_uri: oidcClient.redirectUri,
            state,
            scope: "openid email profile"
        }).toString();

        return { sessionId, authUrl: authUrl.toString() };
    };
};
