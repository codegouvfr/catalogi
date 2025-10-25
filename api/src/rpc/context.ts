// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { SessionRepository, UserRepository } from "../core/ports/DbApiV2";
import { UserWithId } from "../lib/ApiTypes";
import { RefreshSession } from "../core/usecases/auth/refreshSession";

export type Context = {
    currentUser?: UserWithId;
};

export async function createContextFactory({
    userRepository,
    sessionRepository,
    refreshSession
}: {
    userRepository: UserRepository;
    sessionRepository: SessionRepository;
    refreshSession: RefreshSession;
}) {
    async function createContext({ req, res }: CreateExpressContextOptions): Promise<Context> {
        const sessionId = req.cookies?.sessionId;
        if (!sessionId) return {};

        const session = await sessionRepository.findById(sessionId);
        if (!session || session.loggedOutAt || !session.userId) return {};

        const isExpired = !session.expiresAt || session.expiresAt < new Date();

        if (isExpired && session.refreshToken) {
            try {
                await refreshSession(session);
                const currentUser = await userRepository.getBySessionId(sessionId);
                return currentUser ? { currentUser } : {};
            } catch (error) {
                console.error("Token refresh failed:", error);
                await sessionRepository.update({ ...session, loggedOutAt: new Date() });
                res.clearCookie("sessionId");
                return {};
            }
        }

        if (isExpired) {
            return {};
        }

        const currentUser = await userRepository.getBySessionId(sessionId);
        return currentUser ? { currentUser } : {};
    }

    return { createContext };
}
