// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { SessionRepository } from "../core/ports/DbApiV2";
import { type WithUserSubAndEmail } from "./user";

export type Context = {
    user?: WithUserSubAndEmail;
};

export async function createContextFactory(params: { sessionRepository: SessionRepository }) {
    const { sessionRepository } = params;

    async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
        const sessionId = req.cookies?.sessionId;

        if (!sessionId) {
            return {};
        }

        const session = await sessionRepository.findById(sessionId);

        if (!session || !session.userId || !session.email) {
            return {};
        }

        return { user: { sub: session.userId, email: session.email } };
    }

    return { createContext };
}
