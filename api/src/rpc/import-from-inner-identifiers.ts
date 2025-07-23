// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { getDbApiAndInitializeCache } from "../core/adapters/dbApi/kysely/createPgDbApi";
import { makeImportFromInnerIdentifiers } from "../core/usecases/importFromInnerIdentifiers";

export async function startImportFromInnerIdentifersService(params: {
    isDevEnvironnement: boolean;
    databaseUrl: string;
    botUserEmail?: string;
    importDataSourceOrigin: string;
    listToImport?: string[];
}) {
    const { isDevEnvironnement, databaseUrl, botUserEmail, listToImport, importDataSourceOrigin, ...rest } = params;

    assert<Equals<typeof rest, {}>>();

    console.log({ isDevEnvironnement });

    const kyselyDb = new Kysely<Database>({ dialect: createPgDialect(databaseUrl) });
    const { dbApi } = getDbApiAndInitializeCache({
        "dbKind": "kysely",
        "kyselyDb": kyselyDb
    });

    const innerImport = makeImportFromInnerIdentifiers({ dbApi });

    const success = await innerImport();

    success
        ? console.info("[RPC:Import-From-Inner-Identifiers] ✅ Importation from identifiers successful ✅")
        : console.error("[RPC:Import-From-Inner-Identifiers] ❌ Error ❌");
}
