// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { SourceRepository } from "../../../ports/DbApiV2";
import { categoryByKind, Database, USER_INPUT_SOURCE_SLUG } from "./kysely.database";
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
            .executeTakeFirst()
            .then(row => (row ? stripNullOrUndefinedValues(row) : row)),
    // UserInput is a synthetic source that participates in the merge pipeline but is not
    // fetchable. Exclude it here so callers (e.g. getExternalSoftwareOptions) get a real
    // gateway-backed source. Repositories can't be searched by name, so they can't be
    // the main source either.
    getMainSource: async () =>
        db
            .selectFrom("sources")
            .innerJoin("source_categories", "source_categories.category", "sources.category")
            .selectAll("sources")
            .where("slug", "!=", USER_INPUT_SOURCE_SLUG)
            .where("sources.category", "!=", "repository")
            .orderBy("source_categories.priority", "asc")
            .orderBy("sources.slug", "asc")
            .executeTakeFirstOrThrow()
            .then(row => stripNullOrUndefinedValues(row)),
    getWikidataSource: async () =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("kind", "=", "wikidata")
            .orderBy("slug", "asc")
            .executeTakeFirstOrThrow()
            .then(row => stripNullOrUndefinedValues(row)),
    createIfMissing: async ({ slug, kind, url }) => {
        await db
            .insertInto("sources")
            .values({ slug, kind, category: categoryByKind[kind], url, description: null })
            .onConflict(oc => oc.column("slug").doNothing())
            .execute();

        return db
            .selectFrom("sources")
            .selectAll()
            .where("slug", "=", slug)
            .executeTakeFirstOrThrow()
            .then(row => stripNullOrUndefinedValues(row));
    },
    updateLastImport: async (params: { name: string; date: Date }) =>
        db
            .updateTable("sources")
            .where("slug", "=", params.name)
            .set({ "lastImport": params.date })
            .executeTakeFirst()
            .then(res => !!res)
});
