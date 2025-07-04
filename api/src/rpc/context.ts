// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { UserRepository } from "../core/ports/DbApiV2";
import { WithUserSubAndEmail } from "./user";

export type Context = {
    user?: WithUserSubAndEmail;
};

export async function createContextFactory({ userRepository }: { userRepository: UserRepository }) {
    async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
        const sessionId = req.cookies?.sessionId;

        if (!sessionId) {
            return {};
        }

        const user = await userRepository.getBySessionId(sessionId);

        if (!user) {
            return {};
        }

        return { user: { email: user.email, sub: user.sub ?? "" } };
    }

    return { createContext };
}
