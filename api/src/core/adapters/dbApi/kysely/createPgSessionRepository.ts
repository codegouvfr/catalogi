// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { SessionRepository } from "../../../ports/DbApiV2";
import { Database } from "./kysely.database";

export function createPgSessionRepository(params: { kyselyDb: Kysely<Database> }): SessionRepository {
    const { kyselyDb } = params;

    return {
        create: async params => {
            const { id, state, redirectUrl } = params;

            await kyselyDb
                .insertInto("sessions")
                .values({
                    id,
                    state,
                    redirectUrl,
                    userId: null,
                    email: null,
                    sub: null,
                    accessToken: null,
                    refreshToken: null,
                    expiresAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .execute();
        },

        findByState: async state => {
            const session = await kyselyDb
                .selectFrom("sessions")
                .selectAll()
                .where("state", "=", state)
                .executeTakeFirst();

            return session || null;
        },

        findById: async id => {
            const session = await kyselyDb.selectFrom("sessions").selectAll().where("id", "=", id).executeTakeFirst();

            return session || null;
        },

        updateWithUserInfo: async params => {
            const { sessionId, userId, email, sub, accessToken, refreshToken, expiresAt } = params;

            const updatedSession = await kyselyDb
                .updateTable("sessions")
                .set({
                    userId,
                    email,
                    sub,
                    accessToken,
                    refreshToken: refreshToken || null,
                    expiresAt: expiresAt || null,
                    updatedAt: new Date()
                })
                .where("id", "=", sessionId)
                .returningAll()
                .executeTakeFirst();

            return updatedSession || null;
        },

        delete: async sessionId => {
            await kyselyDb.deleteFrom("sessions").where("id", "=", sessionId).execute();
        }
    };
}
