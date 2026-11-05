// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { sql, type Kysely } from "kysely";

// Frozen copy of the kinds that can be queried by name at the time of this migration.
const lookupSourceKinds = ["wikidata", "HAL", "ComptoirDuLibre", "Zenodo"];

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("sources")
        .addColumn("isLookupSource", "boolean", col => col.notNull().defaultTo(false))
        .execute();

    await sql`
        ALTER TABLE sources ADD CONSTRAINT sources_lookup_source_kind_check
        CHECK (NOT "isLookupSource" OR kind::text IN (${sql.join(lookupSourceKinds.map(kind => sql.lit(kind)))}))
    `.execute(db);

    // At most one lookup source; the application always swaps it in a single transaction.
    await sql`CREATE UNIQUE INDEX sources_one_lookup_source ON sources ("isLookupSource") WHERE "isLookupSource"`.execute(
        db
    );

    // The lookup source used to be deduced: the best-ranked category, UserInput and repository
    // excluded. Keep that choice, among the kinds that can actually be queried by name.
    await sql`
        UPDATE sources SET "isLookupSource" = true
        WHERE slug = (
            SELECT s.slug
            FROM sources s
            JOIN source_categories sc ON sc.category = s.category
            WHERE s.kind::text IN (${sql.join(lookupSourceKinds.map(kind => sql.lit(kind)))})
            ORDER BY sc.priority ASC, s.slug ASC
            LIMIT 1
        )
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX sources_one_lookup_source`.execute(db);
    await db.schema.alterTable("sources").dropConstraint("sources_lookup_source_kind_check").execute();
    await db.schema.alterTable("sources").dropColumn("isLookupSource").execute();
}
