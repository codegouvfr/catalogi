// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SessionRepository } from "../../ports/DbApiV2";
import { OidcClient } from "./oidcClient";

type InitiateLogoutDependencies = {
    sessionRepository: SessionRepository;
    oidcClient: OidcClient;
};

type InitiateLogoutParams = {
    sessionId: string;
};

export type InitiateLogout = ReturnType<typeof makeInitiateLogout>;
export const makeInitiateLogout =
    ({ sessionRepository, oidcClient }: InitiateLogoutDependencies) =>
    async ({ sessionId }: InitiateLogoutParams): Promise<{ logoutUrl: string }> => {
        const session = await sessionRepository.findById(sessionId);

        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Mark session as logged out immediately
        await sessionRepository.update({ ...session, loggedOutAt: new Date() });

        // Get logout URL from OIDC client
        const logoutUrl = await oidcClient.logout(session.idToken);

        return { logoutUrl };
    };
