// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SessionRepository } from "../../ports/DbApiV2";
import { OidcClient } from "./oidcClient";

type LogoutDependencies = {
    sessionRepository: SessionRepository;
    oidcClient: OidcClient;
};

type LogoutParams = {
    sessionId: string;
};

export type Logout = ReturnType<typeof makeLogout>;
export const makeLogout =
    ({ sessionRepository, oidcClient }: LogoutDependencies) =>
    async ({ sessionId }: LogoutParams): Promise<void> => {
        const session = await sessionRepository.findById(sessionId);

        if (!session) return;

        await oidcClient.logout(session.accessToken);
        await sessionRepository.update({ ...session, loggedOutAt: new Date() });
    };
