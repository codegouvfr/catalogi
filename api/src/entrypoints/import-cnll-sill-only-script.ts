// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 UniversitÃ© Grenoble Alpes
// SPDX-License-Identifier: MIT

// Note this is temporary script, to use as long CNLL doesn't have a proper API providing their own identifiers
// Do not use this script outside of the main SILL application

import { Kysely } from "kysely";
import { getDbApiAndInitializeCache } from "../core/adapters/dbApi/kysely/createPgDbApi";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { env } from "../env";
import { importCnllSillOnly } from "../rpc/import-cnll-sill-only";

const kyselyDb = new Kysely<Database>({ dialect: createPgDialect(env.databaseUrl) });

const { dbApi } = getDbApiAndInitializeCache({
    "dbKind": "kysely",
    "kyselyDb": kyselyDb
});

importCnllSillOnly(dbApi)
    .then(() => console.log("Import CNLL (SILL only script) - Done"))
    .catch(console.error);
