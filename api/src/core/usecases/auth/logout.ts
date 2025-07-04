// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SessionRepository } from "../../ports/DbApiV2";

type LogoutDependencies = {
    sessionRepository: SessionRepository;
};

type LogoutParams = {
    sessionId: string;
};

export type Logout = ReturnType<typeof makeLogout>;
export const makeLogout =
    ({ sessionRepository }: LogoutDependencies) =>
    async ({ sessionId }: LogoutParams): Promise<void> => {
        await sessionRepository.delete(sessionId);
    };
