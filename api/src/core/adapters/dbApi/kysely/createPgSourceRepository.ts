// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { SourceRepository } from "../../../ports/DbApiV2";
import { Database, USER_INPUT_SOURCE_SLUG, ExternalDataOriginKind } from "./kysely.database";
import { stripNullOrUndefinedValues } from "./kysely.utils";

export const createPgSourceRepository = (db: Kysely<Database>): SourceRepository => ({
    getAll: async (params = { all: false }) => {
        const { all = false } = params;
        let req = db.selectFrom("sources").selectAll();

        if (!all) {
            req = req.where("slug", "!=", USER_INPUT_SOURCE_SLUG);
        }

        return req.execute().then(rows => rows.map(row => stripNullOrUndefinedValues(row)));
    },
    getByName: async (params: { name: string }) =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("slug", "=", params.name)
            .orderBy("priority", "asc")
            .executeTakeFirst()
            .then(row => (row ? stripNullOrUndefinedValues(row) : row)),
    // UserInput is a synthetic source that participates in the merge pipeline but is not
    // fetchable. Exclude it here so callers (e.g. getExternalSoftwareOptions) get a real
    // gateway-backed source.
    getMainSource: async () =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("slug", "!=", USER_INPUT_SOURCE_SLUG)
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
