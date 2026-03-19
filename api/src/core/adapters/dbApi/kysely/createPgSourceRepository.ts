// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { SourceRepository } from "../../../ports/DbApiV2";
import { Database, ExternalDataOriginKind } from "./kysely.database";
import { stripNullOrUndefinedValues } from "./kysely.utils";

export const createPgSourceRepository = (db: Kysely<Database>): SourceRepository => ({
    getAll: async () =>
        db
            .selectFrom("sources")
            .selectAll()
            .execute()
            .then(rows => rows.map(row => stripNullOrUndefinedValues(row))),
    getByName: async (params: { name: string }) =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("slug", "=", params.name)
            .orderBy("priority", "asc")
            .executeTakeFirst()
            .then(row => (row ? stripNullOrUndefinedValues(row) : row)),
    getMainSource: async () =>
        db
            .selectFrom("sources")
            .selectAll()
            .orderBy("priority", "asc")
            .executeTakeFirstOrThrow()
            .then(row => stripNullOrUndefinedValues(row)),
    getWikidataSource: async () =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("kind", "=", "wikidata")
            .orderBy("priority", "asc")
            .executeTakeFirstOrThrow()
            .then(row => stripNullOrUndefinedValues(row)),
    getByType: async (params: { type: ExternalDataOriginKind }) =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("kind", "=", params.type)
            .orderBy("priority", "asc")
            .execute()
            .then(arr => arr.map(stripNullOrUndefinedValues))
});
