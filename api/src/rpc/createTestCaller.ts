// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { bootstrapCore } from "../core";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { getWikidataSoftware } from "../core/adapters/wikidata/getWikidataSoftware";
import { getWikidataSoftwareOptions } from "../core/adapters/wikidata/getWikidataSoftwareOptions";
import { ExternalDataOrigin } from "../core/ports/GetSoftwareExternalData";
import { testPgUrl } from "../tools/test.helpers";
import { createRouter } from "./router";
import { WithUserSubAndEmail } from "./user";

type TestCallerConfig = {
    user: WithUserSubAndEmail | undefined;
};

export const defaultUser: WithUserSubAndEmail = {
    sub: "1",
    email: "default.user@mail.com"
};

export type ApiCaller = Awaited<ReturnType<typeof createTestCaller>>["apiCaller"];

export const createTestCaller = async ({ user }: TestCallerConfig = { user: defaultUser }) => {
    const externalSoftwareDataOrigin: ExternalDataOrigin = "wikidata";
    const kyselyDb = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });

    const { dbApi, useCases, uiConfig } = await bootstrapCore({
        "dbConfig": { dbKind: "kysely", kyselyDb },
        "externalSoftwareDataOrigin": externalSoftwareDataOrigin
    });

    const { router } = createRouter({
        useCases,
        dbApi,
        oidcParams: { issuerUri: "http://fake.url", clientId: "fake-client-id" },
        redirectUrl: undefined,
        externalSoftwareDataOrigin,
        getSoftwareExternalDataOptions: getWikidataSoftwareOptions,
        getSoftwareExternalData: getWikidataSoftware,
        uiConfig
    });

    return { apiCaller: router.createCaller({ user }), kyselyDb };
};
