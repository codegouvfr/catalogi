// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("author_organizations")
        .addColumn("id", "text", col => col.primaryKey())
        .addColumn("organization", "jsonb", col => col.notNull())
        .addColumn("wikidata_id", "text")
        .addColumn("insi_id", "text")
        .addColumn("cross_ref_id", "text")
        .addColumn("grid_id", "text")
        .addColumn("ror_id", "text")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("authors_organizations").execute();
}
