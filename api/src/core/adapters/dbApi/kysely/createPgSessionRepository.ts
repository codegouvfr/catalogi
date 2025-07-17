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
                    accessToken: null,
                    refreshToken: null,
                    expiresAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .execute();
        },

        findByState: async state =>
            kyselyDb.selectFrom("sessions").selectAll().where("state", "=", state).executeTakeFirst(),

        findById: async id => kyselyDb.selectFrom("sessions").selectAll().where("id", "=", id).executeTakeFirst(),

        updateWithUserInfo: async params => {
            const { id, userId, email, accessToken, refreshToken, expiresAt } = params;

            const result = await kyselyDb
                .updateTable("sessions")
                .set({
                    userId,
                    email,
                    accessToken,
                    refreshToken: refreshToken || null,
                    expiresAt: expiresAt || null,
                    updatedAt: new Date()
                })
                .where("id", "=", id)
                .executeTakeFirst();

            if (Number(result.numChangedRows) === 0) {
                throw new Error(`Session not found for id : ${id}`);
            }
        },

        delete: async sessionId => {
            await kyselyDb.deleteFrom("sessions").where("id", "=", sessionId).execute();
        }
    };
}
