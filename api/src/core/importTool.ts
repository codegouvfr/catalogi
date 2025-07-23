// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { createKyselyPgDbApi } from "./adapters/dbApi/kysely/createPgDbApi";
import { Database } from "./adapters/dbApi/kysely/kysely.database";
import { DbApiV2 } from "./ports/DbApiV2";
import { importFromSource } from "./usecases/importFromSource";

type PgDbConfig = { dbKind: "kysely"; kyselyDb: Kysely<Database> };

type DbConfig = PgDbConfig;

type ParamsOfImportTool = {
    dbConfig: DbConfig;
    botUserEmail: string | undefined;
    sourceSlug: string;
    listToImport?: string[];
};

const getDbApiAndInitializeCache = (dbConfig: DbConfig): { dbApi: DbApiV2 } => {
    if (dbConfig.dbKind === "kysely") {
        return {
            dbApi: createKyselyPgDbApi(dbConfig.kyselyDb)
        };
    }

    const shouldNotBeReached: never = dbConfig.dbKind;
    throw new Error(`[Loader:Import] Unsupported case: ${shouldNotBeReached}`);
};

export async function importTool(params: ParamsOfImportTool): Promise<boolean> {
    const { dbConfig, botUserEmail, listToImport, sourceSlug } = params;

    const { dbApi } = getDbApiAndInitializeCache(dbConfig);

    if (!botUserEmail) throw new Error("[Loader:Import] No bot agent email provided");

    const source = await dbApi.source.getByName({ name: sourceSlug });
    if (!source) throw new Error("[Loader:Import] Couldn't find the source to connect to");

    const loggerTime = `[Loader:Import] Feeded database with software packages from ${source.slug}`;

    const importService = importFromSource(dbApi);

    console.time(loggerTime);
    return importService({ userEmail: botUserEmail, source, softwareIdOnSource: listToImport }).then(result => {
        console.log(`[Loader:Import] Feeding database with ${result.length} software packages`);
        console.timeEnd(loggerTime);
        return true;
    });
}
