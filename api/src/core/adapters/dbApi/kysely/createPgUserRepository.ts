// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import { UserRepository } from "../../../ports/DbApiV2";
import { Os } from "../../../usecases/readWriteSillData";
import type { Database } from "./kysely.database";
import { jsonBuildObject, jsonStripNulls } from "./kysely.utils";

export const createPgAgentRepository = (db: Kysely<Database>): UserRepository => ({
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
        const dbAgent = await makeGetAgentBuilder(db).where("email", "=", email).executeTakeFirst();
        if (!dbAgent) return;

        const { usersDeclarations, referentsDeclarations, ...rest } = dbAgent;

        return {
            ...rest,
            about: rest.about ?? undefined,
            declarations: [...usersDeclarations, ...referentsDeclarations]
        };
    },
    getAll: () =>
        makeGetAgentBuilder(db)
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

const makeGetAgentBuilder = (db: Kysely<Database>) =>
    db
        .selectFrom("users as a")
        .leftJoin("software_users as u", "a.id", "u.userId")
        .leftJoin("softwares as us", "u.softwareId", "us.id")
        .leftJoin("software_referents as r", "a.id", "r.userId")
        .leftJoin("softwares as rs", "r.softwareId", "rs.id")
        .select([
            "a.id",
            "a.email",
            "a.isPublic",
            "a.about",
            "a.organization",
            ({ ref, fn }) =>
                fn
                    .coalesce(
                        fn
                            .jsonAgg(
                                jsonStripNulls(
                                    jsonBuildObject({
                                        declarationType: sql<"user">`'user'`,
                                        serviceUrl: ref("u.serviceUrl"),
                                        usecaseDescription: ref("u.useCaseDescription").$castTo<string>(),
                                        version: ref("u.version").$castTo<string>(),
                                        os: ref("u.os").$castTo<Os>(),
                                        softwareName: ref("us.name").$castTo<string>()
                                    })
                                )
                            )
                            .filterWhere("u.userId", "is not", null),
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
                            .filterWhere("r.userId", "is not", null),
                        sql<[]>`'[]'`
                    )
                    .as("referentsDeclarations")
        ])
        .groupBy("a.id");
