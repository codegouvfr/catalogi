// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { bootstrapCore } from "../core";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { Session } from "../core/ports/DbApiV2";
import { testPgUrl } from "../tools/test.helpers";
import { createRouter } from "./router";
import { UserWithId } from "../lib/ApiTypes";

type TestCallerConfig = {
    currentUser: UserWithId | undefined;
    db?: Kysely<Database>;
};

export const defaultUser: UserWithId = {
    id: 1,
    sub: "default-user-sub",
    email: "default.user@mail.com",
    organization: "default",
    isPublic: false,
    about: "",
    declarations: []
};

export type ApiCaller = Awaited<ReturnType<typeof createTestCaller>>["apiCaller"];

export const createTestCaller = async ({ currentUser, db }: TestCallerConfig = { currentUser: defaultUser }) => {
    const kyselyDb = db ?? new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });

    const { dbApi, useCases, uiConfig } = await bootstrapCore({
        "dbConfig": { dbKind: "kysely", kyselyDb },
        "oidcKind": "test",
        "oidcParams": {
            issuerUri: "http://fake.url",
            clientId: "fake-client-id",
            clientSecret: "fake-client-secret",
            appUrl: "http://localhost:3000"
        }
    });

    const { router } = createRouter({
        useCases,
        dbApi,
        oidcParams: {
            issuerUri: "http://fake.url",
            clientId: "fake-client-id",
            clientSecret: "fake-client-secret",
            manageProfileUrl: "http://fake.url/manage-profile",
            appUrl: "http://localhost:3000"
        },
        redirectUrl: undefined,
        uiConfig
    });

    if (currentUser) {
        // creating the current user with an active session
        const { declarations, ...rest } = currentUser;
        await dbApi.user.add(rest);
        const session: Session = {
            id: "11111111-1111-1111-1111-111111111111",
            state: "test-state",
            redirectUrl: null,
            userId: currentUser.id,
            email: currentUser.email,
            accessToken: "test-access-token",
            refreshToken: "test-refresh-token",
            idToken: "test-id-token",
            expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
            createdAt: new Date(),
            updatedAt: new Date(),
            loggedOutAt: null
        };
        await dbApi.session.create(session);
        await dbApi.session.update(session);
    }

    return { apiCaller: router.createCaller({ currentUser }), kyselyDb };
};
