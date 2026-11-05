// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
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
    getLookupSource: async () =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("isLookupSource", "=", true)
            .executeTakeFirstOrThrow(() => new Error("No lookup source is configured"))
            .then(row => stripNullOrUndefinedValues(row)),
    setLookupSource: async ({ slug }) =>
        db.transaction().execute(async trx => {
            await trx
                .updateTable("sources")
                .set({ isLookupSource: false })
                .where("isLookupSource", "=", true)
                .execute();
            const { numUpdatedRows } = await trx
                .updateTable("sources")
                .set({ isLookupSource: true })
                .where("slug", "=", slug)
                .executeTakeFirst();
            if (numUpdatedRows === BigInt(0)) throw new Error(`No source "${slug}"`);
        }),
    getCategoryPriorities: async () =>
        db
            .selectFrom("source_categories")
            .select(["category", "priority"])
            .execute()
            .then(rows => Object.fromEntries(rows.map(({ category, priority }) => [category, priority]))),
    reorderCategories: async ({ categories }) =>
        db.transaction().execute(async trx => {
            // `priority` is UNIQUE and not deferrable: move every row out of the way first.
            await trx
                .updateTable("source_categories")
                .set({ priority: sql<number>`-1 - priority` })
                .execute();
            for (const [priority, category] of categories.entries()) {
                const { numUpdatedRows } = await trx
                    .updateTable("source_categories")
                    .set({ priority })
                    .where("category", "=", category)
                    .executeTakeFirst();
                if (numUpdatedRows === BigInt(0)) throw new Error(`No source category "${category}"`);
            }
        }),
    countSoftwaresBySlug: async () =>
        db
            .selectFrom("software_external_datas")
            .where("softwareId", "is not", null)
            .select(({ fn }) => ["sourceSlug", fn.count<string>("softwareId").distinct().as("count")])
            .groupBy("sourceSlug")
            .execute()
            .then(rows => Object.fromEntries(rows.map(({ sourceSlug, count }) => [sourceSlug, Number(count)]))),
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
    update: async ({ slug, url, configuration }) => {
        const changes = {
            ...(url !== undefined && { url }),
            ...(configuration !== undefined && { configuration: JSON.stringify(configuration) })
        };
        if (Object.keys(changes).length === 0) return;

        const { numUpdatedRows } = await db
            .updateTable("sources")
            .set(changes)
            .where("slug", "=", slug)
            .executeTakeFirst();
        if (numUpdatedRows === BigInt(0)) throw new Error(`No source "${slug}"`);
    },
    updateLastImport: async (params: { name: string; date: Date }) =>
        db
            .updateTable("sources")
            .where("slug", "=", params.name)
            .set({ "lastImport": params.date })
            .executeTakeFirst()
            .then(res => !!res)
});
