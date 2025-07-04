// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { SoftwareReferentRepository, SoftwareUserRepository } from "../../../ports/DbApiV2";
import { Database } from "./kysely.database";

export const createPgUserRepository = (db: Kysely<Database>): SoftwareUserRepository => ({
    add: async user => {
        await db.insertInto("software_users").values(user).execute();
    },
    remove: async ({ softwareId, agentId }) => {
        await db
            .deleteFrom("software_users")
            .where("softwareId", "=", softwareId)
            .where("userId", "=", agentId)
            .execute();
    },
    countSoftwaresForAgent: async (params: { agentId: number }) => {
        const { count } = await db
            .selectFrom("software_users")
            .select(qb => qb.fn.countAll<string>().as("count"))
            .where("userId", "=", params.agentId)
            .executeTakeFirstOrThrow();

        return +count;
    }
});

export const createPgReferentRepository = (db: Kysely<Database>): SoftwareReferentRepository => ({
    add: async referent => {
        await db.insertInto("software_referents").values(referent).execute();
    },
    remove: async ({ softwareId, agentId }) => {
        await db
            .deleteFrom("software_referents")
            .where("softwareId", "=", softwareId)
            .where("userId", "=", agentId)
            .execute();
    },
    countSoftwaresForAgent: async (params: { agentId: number }) => {
        const { count } = await db
            .selectFrom("software_referents")
            .select(qb => qb.fn.countAll<string>().as("count"))
            .where("userId", "=", params.agentId)
            .executeTakeFirstOrThrow();

        return +count;
    },
    getTotalCount: async () => {
        const { total_referents } = await db
            .selectFrom("software_referents")
            .select(qb => qb.fn.count<string>("userId").distinct().as("total_referents"))
            .executeTakeFirstOrThrow();
        return parseInt(total_referents);
    }
});
