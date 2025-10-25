// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Session, SessionRepository } from "../../ports/DbApiV2";
import { OidcClient } from "./oidcClient";
import { DEFAULT_SESSION_DURATION_MS } from "./handleAuthCallback";

type RefreshSessionDependencies = {
    sessionRepository: SessionRepository;
    oidcClient: OidcClient;
};

export type RefreshSession = Awaited<ReturnType<typeof makeRefreshSession>>;
export const makeRefreshSession = ({ sessionRepository, oidcClient }: RefreshSessionDependencies) => {
    return async (session: Session): Promise<Session> => {
        if (!session.refreshToken) {
            throw new Error("No refresh token available for session");
        }

        const tokens = await oidcClient.refreshAccessToken(session.refreshToken);

        // Use OIDC provider's expires_in, defaulting if not provided
        const sessionDurationMs = tokens.expires_in ? tokens.expires_in * 1000 : DEFAULT_SESSION_DURATION_MS;

        const updatedSession: Session = {
            ...session,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? session.refreshToken,
            idToken: tokens.id_token ?? session.idToken,
            expiresAt: new Date(Date.now() + sessionDurationMs)
        };

        await sessionRepository.update(updatedSession);

        return updatedSession;
    };
};
