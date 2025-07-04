// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import { AgentRepository } from "../../../ports/DbApiV2";
import { Os } from "../../../usecases/readWriteSillData";
import type { Database } from "./kysely.database";
import { jsonBuildObject, jsonStripNulls } from "./kysely.utils";

export const createPgAgentRepository = (db: Kysely<Database>): AgentRepository => ({
    add: async agent => {
        const { id } = await db.insertInto("users").values(agent).returning("id").executeTakeFirstOrThrow();
        return id;
    },
    update: async agent => {
        const { declarations, ...dbAgent } = agent;
        await db.updateTable("users").set(dbAgent).where("id", "=", agent.id).execute();
    },
    remove: async agentId => {
        await db.deleteFrom("users").where("id", "=", agentId).execute();
    },
    getByEmail: async email => {
        const dbAgent = await makeGetUserBuilder(db).where("email", "=", email).executeTakeFirst();
        if (!dbAgent) return;

        const { usersDeclarations, referentsDeclarations, ...rest } = dbAgent;

        return {
            ...rest,
            about: rest.about ?? undefined,
            declarations: [...usersDeclarations, ...referentsDeclarations]
        };
    },
    getAll: () =>
        makeGetUserBuilder(db)
            .execute()
            .then(results =>
                results.map(({ usersDeclarations, referentsDeclarations, about, ...rest }) => ({
                    ...rest,
                    about: about ?? undefined,
                    declarations: [...usersDeclarations, ...referentsDeclarations]
                }))
            ),
    countAll: () =>
        db
            .selectFrom("users")
            .select(qb => qb.fn.countAll<number>().as("count"))
            .executeTakeFirstOrThrow()
            .then(({ count }) => +count),
    getAllOrganizations: () =>
        db
            .selectFrom("users")
            .where("organization", "is not", null)
            .groupBy("organization")
            .orderBy("organization")
            .select(({ ref }) => ref("organization").$castTo<string>().as("organization"))
            .execute()
            .then(results => results.map(({ organization }) => organization))
});

const makeGetUserBuilder = (db: Kysely<Database>) =>
    db
        .selectFrom("users")
        .leftJoin("software_users", "users.id", "software_users.agentId")
        .leftJoin("softwares as us", "software_users.softwareId", "us.id")
        .leftJoin("software_referents as r", "users.id", "r.agentId")
        .leftJoin("softwares as rs", "r.softwareId", "rs.id")
        .select([
            "users.id",
            "users.email",
            "users.isPublic",
            "users.about",
            "users.organization",
            ({ ref, fn }) =>
                fn
                    .coalesce(
                        fn
                            .jsonAgg(
                                jsonStripNulls(
                                    jsonBuildObject({
                                        declarationType: sql<"user">`'user'`,
                                        serviceUrl: ref("software_users.serviceUrl"),
                                        usecaseDescription: ref("software_users.useCaseDescription").$castTo<string>(),
                                        version: ref("software_users.version").$castTo<string>(),
                                        os: ref("software_users.os").$castTo<Os>(),
                                        softwareName: ref("us.name").$castTo<string>()
                                    })
                                )
                            )
                            .filterWhere("software_users.agentId", "is not", null),
                        sql<[]>`'[]'`
                    )
                    .as("usersDeclarations"),
            ({ ref, fn }) =>
                fn
                    .coalesce(
                        fn
                            .jsonAgg(
                                jsonStripNulls(
                                    jsonBuildObject({
                                        declarationType: sql<"referent">`'referent'`,
                                        isTechnicalExpert: ref("r.isExpert").$castTo<boolean>(),
                                        usecaseDescription: ref("r.useCaseDescription").$castTo<string>(),
                                        serviceUrl: ref("r.serviceUrl"),
                                        softwareName: ref("rs.name").$castTo<string>()
                                    })
                                )
                            )
                            .filterWhere("r.agentId", "is not", null),
                        sql<[]>`'[]'`
                    )
                    .as("referentsDeclarations")
        ])
        .groupBy("users.id");
