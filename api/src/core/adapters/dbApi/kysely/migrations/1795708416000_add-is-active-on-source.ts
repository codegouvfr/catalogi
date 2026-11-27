// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { sql, type Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("sources")
        .addColumn("isActive", "boolean", col => col.notNull().defaultTo(true))
        .execute();

    // The software form searches the lookup source by name: it must stay fetched.
    await sql`
        ALTER TABLE sources ADD CONSTRAINT sources_lookup_source_active_check
        CHECK (NOT "isLookupSource" OR "isActive")
    `.execute(db);

    // A forge without credentials is mostly one harvested from a repository URL, often
    // behind an authentication: it fails every fetch. An admin reactivates the public ones.
    await sql`
        UPDATE sources SET "isActive" = false
        WHERE kind IN ('GitHub', 'GitLab')
          AND NOT "isLookupSource"
          AND COALESCE(configuration->>'auth', '') = ''
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("sources").dropConstraint("sources_lookup_source_active_check").execute();
    await db.schema.alterTable("sources").dropColumn("isActive").execute();
}
