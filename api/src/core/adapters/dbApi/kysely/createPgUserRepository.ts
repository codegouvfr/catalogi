// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import { UserRepository } from "../../../ports/DbApiV2";
import { Os, UserWithId } from "../../../usecases/readWriteSillData";
import type { Database } from "./kysely.database";
import { jsonBuildObject, jsonStripNulls } from "./kysely.utils";

export const createPgUserRepository = (db: Kysely<Database>): UserRepository => ({
    add: async user => {
        const now = new Date();
        const { id } = await db
            .insertInto("users")
            .values({
                ...user,
                createdAt: now,
                updatedAt: now
            })
            .returning("id")
            .executeTakeFirstOrThrow();
        return id;
    },
    update: async user => {
        const { declarations, ...dbUser } = user;

        const userInDb = await db.selectFrom("users").selectAll().where("id", "=", user.id).executeTakeFirst();
        if (!userInDb) throw new Error(`User not found`);

        const hasChanges = Object.keys(dbUser).some(key => {
            const currentValue = userInDb[key as keyof typeof userInDb];
            const newValue = dbUser[key as keyof typeof dbUser];
            return currentValue !== newValue;
        });

        if (hasChanges) {
            await db
                .updateTable("users")
                .set({
                    ...dbUser,
                    updatedAt: new Date()
                })
                .where("id", "=", user.id)
                .execute();
        }
    },
    remove: async userId => {
        await db.deleteFrom("users").where("id", "=", userId).execute();
    },
    getByEmail: async email => {
        const dbUser = await makeGetUserBuilder(db).where("email", "=", email).executeTakeFirst();
        return convertDbUserToUserWithId(dbUser);
    },
    getBySub: async sub => {
        const dbUser = await makeGetUserBuilder(db).where("sub", "=", sub).executeTakeFirst();
        return convertDbUserToUserWithId(dbUser);
    },
    getBySessionId: async sessionId => {
        const builder = db
            .selectFrom("user_sessions as sessions")
            .innerJoin("users", "sessions.userId", "users.id")
            .leftJoin("software_users", "users.id", "software_users.userId")
            .leftJoin("softwares as us", "software_users.softwareId", "us.id")
            .leftJoin("software_referents as r", "users.id", "r.userId")
            .leftJoin("softwares as rs", "r.softwareId", "rs.id")
            .select([
                "users.id",
                "users.email",
                "users.isPublic",
                "users.about",
                "users.organization",
                "users.sub",
                ({ ref, fn }) =>
                    fn
                        .coalesce(
                            fn
                                .jsonAgg(
                                    jsonStripNulls(
                                        jsonBuildObject({
                                            declarationType: sql<"user">`'user'`,
                                            serviceUrl: ref("software_users.serviceUrl"),
                                            usecaseDescription: ref(
                                                "software_users.useCaseDescription"
                                            ).$castTo<string>(),
                                            version: ref("software_users.version").$castTo<string>(),
                                            os: ref("software_users.os").$castTo<Os>(),
                                            softwareName: ref("us.name").$castTo<string>()
                                        })
                                    )
                                )
                                .filterWhere("software_users.userId", "is not", null),
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
            .groupBy("users.id")
            .where("sessions.id", "=", sessionId)
            .where("sessions.loggedOutAt", "is", null)
            .where(eb => eb.or([eb("sessions.expiresAt", "is", null), eb("sessions.expiresAt", ">", new Date())]));

        const dbUser = await builder.executeTakeFirst();
        return convertDbUserToUserWithId(dbUser);
    },
    getAll: () =>
        makeGetUserBuilder(db)
            .execute()
            .then(results => results.map(convertDbUserToUserWithId)),
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
        .leftJoin("software_users", "users.id", "software_users.userId")
        .leftJoin("softwares as us", "software_users.softwareId", "us.id")
        .leftJoin("software_referents as r", "users.id", "r.userId")
        .leftJoin("softwares as rs", "r.softwareId", "rs.id")
        .select([
            "users.id",
            "users.email",
            "users.isPublic",
            "users.about",
            "users.organization",
            "users.sub",
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
                            .filterWhere("software_users.userId", "is not", null),
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
        .groupBy("users.id");

const _forTypeOnly = (db: Kysely<Database>) => makeGetUserBuilder(db).executeTakeFirst();

type RawDbUser = Awaited<ReturnType<typeof _forTypeOnly>>;

const convertDbUserToUserWithId = <T extends RawDbUser>(
    dbUser: T
): T extends undefined ? UserWithId | undefined : UserWithId => {
    if (!dbUser) return undefined as any;
    const { usersDeclarations, referentsDeclarations, ...rest } = dbUser;
    return {
        ...rest,
        id: rest.id as unknown as number,
        about: rest.about ?? undefined,
        declarations: [...usersDeclarations, ...referentsDeclarations]
    };
};
