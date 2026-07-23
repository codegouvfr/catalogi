// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import {
    pruneAuthorOrganization,
    saveAndgetSoftwareIdsByOrganisation,
    rebuildSoftwareIdsByOrganisation
} from "../core/usecases/getAuthorOrganization";
import { createKyselyPgDbApi } from "../core/adapters/dbApi/kysely/createPgDbApi";
import { DbApiV2 } from "../core/ports/DbApiV2";

type PgDbConfig = { dbKind: "kysely"; kyselyDb: Kysely<Database> };

type DbConfig = PgDbConfig;

const getDbApiAndInitializeCache = (dbConfig: DbConfig): { dbApi: DbApiV2 } => {
    if (dbConfig.dbKind === "kysely") {
        return {
            dbApi: createKyselyPgDbApi(dbConfig.kyselyDb)
        };
    }

    const shouldNotBeReached: never = dbConfig.dbKind;
    throw new Error(`Unsupported case: ${shouldNotBeReached}`);
};

export async function authorOrganizationUtils(params: {
    env: {
        isDevEnvironnement: boolean;
        databaseUrl: string;
    };
    args: {};
}) {
    console.log("[RPC:authororganization] Loading component");
    const { isDevEnvironnement, databaseUrl, ...rest } = params.env;

    assert<Equals<typeof rest, {}>>();

    console.log({ isDevEnvironnement });

    const kyselyDb = new Kysely<Database>({ dialect: createPgDialect(databaseUrl) });

    const { dbApi } = getDbApiAndInitializeCache({
        "dbKind": "kysely",
        "kyselyDb": kyselyDb
    });

    return {
        prune: () => pruneAuthorOrganization({ dbApi }),
        build: () => saveAndgetSoftwareIdsByOrganisation({ dbApi }),
        rebuild: () => rebuildSoftwareIdsByOrganisation({ dbApi })
    };
}
