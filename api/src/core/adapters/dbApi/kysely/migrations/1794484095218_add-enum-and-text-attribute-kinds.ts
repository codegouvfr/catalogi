// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await sql`ALTER TYPE attribute_kind ADD VALUE IF NOT EXISTS 'enum'`.execute(db);
    await sql`ALTER TYPE attribute_kind ADD VALUE IF NOT EXISTS 'text'`.execute(db);

    await db.schema.alterTable("software_attribute_definitions").addColumn("options", "jsonb").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.deleteFrom("software_attribute_definitions").where("kind", "in", ["enum", "text"]).execute();
    await db.schema.alterTable("software_attribute_definitions").dropColumn("options").execute();

    await db.schema
        .alterTable("software_attribute_definitions")
        .alterColumn("kind", col => col.setDataType("text"))
        .execute();
    await db.schema.dropType("attribute_kind").execute();
    await db.schema.createType("attribute_kind").asEnum(["boolean", "string", "number", "date", "url"]).execute();
    await db.schema
        .alterTable("software_attribute_definitions")
        .alterColumn("kind", col => col.setDataType(sql`attribute_kind USING kind::attribute_kind`))
        .execute();
}
