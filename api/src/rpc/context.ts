// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { UserRepository } from "../core/ports/DbApiV2";
import { UserWithId } from "../lib/ApiTypes";

export type Context = {
    currentUser?: UserWithId;
};

export async function createContextFactory({ userRepository }: { userRepository: UserRepository }) {
    async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
        console.log("cookies ?: ", req.cookies);
        const currentUser = await userRepository.getBySessionId(req.cookies?.sessionId);
        console.log("getting current user : ", currentUser);
        return currentUser ? { currentUser } : {};
    }

    return { createContext };
}
