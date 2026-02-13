// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { makeRefreshExternalDataAll } from "../core/usecases/refreshExternalData";
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

export async function startUpdateService(params: {
    isDevEnvironnement: boolean;
    databaseUrl: string;
    updateSkipTimingInMinutes?: number;
    updateSoftwareIds?: number[];
}) {
    console.log("[RPC:Update] Starting fetching of external data on remote sources");
    console.time("[RPC:Update] Fetching of external data on remote sources: Done");
    const { isDevEnvironnement, databaseUrl, updateSkipTimingInMinutes, updateSoftwareIds, ...rest } = params;

    assert<Equals<typeof rest, {}>>();

    console.log({ isDevEnvironnement });

    const kyselyDb = new Kysely<Database>({ dialect: createPgDialect(databaseUrl) });

    const { dbApi } = getDbApiAndInitializeCache({
        "dbKind": "kysely",
        "kyselyDb": kyselyDb
    });

    const refreshExternalData = await makeRefreshExternalDataAll({
        dbApi,
        minuteSkipSince: updateSkipTimingInMinutes ?? 180,
        softwareIdsToRefresh: updateSoftwareIds
    });

    await refreshExternalData();

    console.timeEnd("[RPC:Update] Fetching of external data on remote sources: Done");
}
