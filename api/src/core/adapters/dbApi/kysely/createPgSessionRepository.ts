// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { SessionRepository } from "../../../ports/DbApiV2";
import { Database } from "./kysely.database";

export function createPgSessionRepository(db: Kysely<Database>): SessionRepository {
    return {
        create: async params => {
            const { id, state, redirectUrl } = params;

            await db
                .insertInto("user_sessions")
                .values({
                    id,
                    state,
                    redirectUrl,
                    userId: null,
                    email: null,
                    accessToken: null,
                    refreshToken: null,
                    idToken: null,
                    expiresAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .execute();
        },

        findByState: async state =>
            db.selectFrom("user_sessions").selectAll().where("state", "=", state).executeTakeFirst(),

        findById: async id => db.selectFrom("user_sessions").selectAll().where("id", "=", id).executeTakeFirst(),

        update: async params => {
            const { id, userId, email, accessToken, refreshToken, idToken, expiresAt, loggedOutAt } = params;

            const result = await db
                .updateTable("user_sessions")
                .set({
                    userId,
                    email,
                    accessToken,
                    refreshToken,
                    idToken,
                    expiresAt,
                    loggedOutAt,
                    updatedAt: new Date()
                })
                .where("id", "=", id)
                .executeTakeFirst();

            if (Number(result.numChangedRows) === 0) {
                throw new Error(`Session not found for id : ${id}`);
            }
        },

        deleteSessionsNotCompletedByUser: async () => {
            const oneDayInMilliseconds = 1000 * 60 * 60 * 24;
            const yesterday = new Date(Date.now() - oneDayInMilliseconds);
            await db
                .deleteFrom("user_sessions")
                .where("userId", "is", null)
                .where("createdAt", "<", yesterday)
                .execute();
        }
    };
}
