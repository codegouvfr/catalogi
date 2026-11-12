// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import { SourceRepository } from "../../../ports/DbApiV2";
import {
    decryptSourceCredential,
    encryptSourceCredential,
    isEncryptedSourceCredential,
    type SourceCredentialsKey
} from "../../../../tools/sourceCredentialCipher";
import { categoryByKind, Database, SourceConfig, USER_INPUT_SOURCE_SLUG } from "./kysely.database";
import { stripNullOrUndefinedValues } from "./kysely.utils";

const mapAuth = <Row extends { configuration?: SourceConfig }>(row: Row, map: (auth: string) => string): Row =>
    row.configuration?.auth === undefined
        ? row
        : { ...row, configuration: { ...row.configuration, auth: map(row.configuration.auth) } };

const decryptAuth = <Row extends { configuration?: SourceConfig }>(
    key: SourceCredentialsKey | undefined,
    row: Row
): Row => mapAuth(row, auth => decryptSourceCredential(key, auth));

const encryptAuth = (key: SourceCredentialsKey | undefined, configuration: SourceConfig): SourceConfig =>
    key === undefined
        ? configuration
        : mapAuth({ configuration }, auth => encryptSourceCredential(key, auth)).configuration;

export const createPgSourceRepository = (
    db: Kysely<Database>,
    { sourceCredentialsKey }: { sourceCredentialsKey: SourceCredentialsKey | undefined }
): SourceRepository => ({
    getAll: async (params = { all: false }) => {
        const { all = false } = params;
        let req = db.selectFrom("sources").selectAll();

        if (!all) {
            req = req.where("slug", "!=", USER_INPUT_SOURCE_SLUG);
        }

        return req
            .execute()
            .then(rows => rows.map(row => decryptAuth(sourceCredentialsKey, stripNullOrUndefinedValues(row))));
    },
    getByName: async (params: { name: string }) =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("slug", "=", params.name)
            .executeTakeFirst()
            .then(row => (row ? decryptAuth(sourceCredentialsKey, stripNullOrUndefinedValues(row)) : row)),
    getLookupSource: async () =>
        db
            .selectFrom("sources")
            .selectAll()
            .where("isLookupSource", "=", true)
            .executeTakeFirstOrThrow(() => new Error("No lookup source is configured"))
            .then(row => decryptAuth(sourceCredentialsKey, stripNullOrUndefinedValues(row))),
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
            .then(row => decryptAuth(sourceCredentialsKey, stripNullOrUndefinedValues(row))),
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
            .then(row => decryptAuth(sourceCredentialsKey, stripNullOrUndefinedValues(row)));
    },
    update: async ({ slug, url, configuration }) => {
        const changes = {
            ...(url !== undefined && { url }),
            ...(configuration !== undefined && {
                configuration: JSON.stringify(encryptAuth(sourceCredentialsKey, configuration))
            })
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
            .then(res => !!res),
    encryptPlainCredentials: async () => {
        const rows = await db
            .selectFrom("sources")
            .select(["slug", sql<string>`configuration->>'auth'`.as("auth")])
            .where(sql`configuration->>'auth'`, "is not", null)
            .execute();

        for (const { slug, auth } of rows) {
            decryptSourceCredential(sourceCredentialsKey, auth);
            if (sourceCredentialsKey === undefined || isEncryptedSourceCredential(auth)) continue;

            const encrypted = encryptSourceCredential(sourceCredentialsKey, auth);
            await db
                .updateTable("sources")
                .set({ configuration: sql`jsonb_set(configuration, '{auth}', to_jsonb(${encrypted}::text))` })
                .where("slug", "=", slug)
                .where(sql`configuration->>'auth'`, "=", auth)
                .execute();
        }
    }
});
