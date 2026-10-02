// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import {
    Database,
    DEFAULT_APP_STATUS,
    SoftwareCatalogueStatusNames,
    STATUS_LIST
} from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { importTool } from "../core/importTool";

export async function startImportService(params: {
    env: {
        isDevEnvironnement: boolean;
        databaseUrl: string;
        botUserEmail?: string;
        importDataSourceOrigin: string;
        listToImport?: string[];
    };
    args: {
        sourceSlug?: string;
        externalIdsToImport?: string[];
        catalogStatus?: string;
    };
}) {
    const { isDevEnvironnement, databaseUrl, botUserEmail, listToImport, importDataSourceOrigin, ...rest } = params.env;
    const { sourceSlug: argSourceSlug, externalIdsToImport: argExternalIdsToImport, catalogStatus } = params.args;

    assert<Equals<typeof rest, {}>>();

    console.log({ isDevEnvironnement });

    if (catalogStatus && (STATUS_LIST as string[]).includes(catalogStatus))
        throw new RangeError(`${catalogStatus} is not a recognize software catalogue status`);

    const kyselyDb = new Kysely<Database>({ dialect: createPgDialect(databaseUrl) });

    const catalogStatusTarget = (catalogStatus ?? DEFAULT_APP_STATUS) as SoftwareCatalogueStatusNames;

    const parsedList =
        argExternalIdsToImport?.length && argExternalIdsToImport.length === 1
            ? argExternalIdsToImport[0].split(",")
            : undefined;

    const success = await importTool({
        "dbConfig": {
            "dbKind": "kysely",
            "kyselyDb": kyselyDb
        },
        "botUserEmail": botUserEmail,
        "sourceSlug": argSourceSlug ?? importDataSourceOrigin,
        "listToImport": parsedList ?? argExternalIdsToImport ?? listToImport ?? [],
        "catalogStatusTarget": catalogStatusTarget
    });

    success ? console.info("[RPC:Import] ✅ Importation successful ✅") : console.error("[RPC:Import] ❌ Error ❌");
}
