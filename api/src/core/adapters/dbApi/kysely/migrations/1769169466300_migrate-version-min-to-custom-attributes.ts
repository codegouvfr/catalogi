// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // 1. Add versionMin attribute definition
    await db
        .insertInto("software_attribute_definitions")
        .values({
            name: "versionMin",
            kind: sql`'string'::attribute_kind`,
            label: sql`'{"fr": "Version minimale requise", "en": "Minimal required version"}'::jsonb`,
            description: sql`'{"fr": "Version la plus ancienne encore acceptable en production", "en": "Earliest version still acceptable to have in production"}'::jsonb`,
            displayInForm: true,
            displayInDetails: true,
            displayInCardIcon: null,
            enableFiltering: false,
            required: false,
            displayOrder: 4
        })
        .execute();

    // 2. Migrate existing data to customAttributes
    await db
        .updateTable("softwares")
        .set({
            customAttributes: sql`"customAttributes" || jsonb_build_object('versionMin', "versionMin")`
        })
        .where("versionMin", "is not", null)
        .where("versionMin", "!=", "")
        .execute();

    // 3. Drop the column
    await db.schema.alterTable("softwares").dropColumn("versionMin").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // 1. Restore column
    await db.schema.alterTable("softwares").addColumn("versionMin", "text").execute();

    // 2. Migrate data from customAttributes
    await db
        .updateTable("softwares")
        .set({
            versionMin: sql`"customAttributes"->>'versionMin'`
        })
        .execute();

    // 3. Remove versionMin from customAttributes
    await db
        .updateTable("softwares")
        .set({
            customAttributes: sql`"customAttributes" - 'versionMin'`
        })
        .execute();

    // 4. Delete definition
    await db.deleteFrom("software_attribute_definitions").where("name", "=", "versionMin").execute();
}
