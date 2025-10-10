// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Create enum type for attribute kinds
    await db.schema.createType("attribute_kind").asEnum(["boolean", "string", "number", "date", "url"]).execute();
    await db.schema
        .createType("display_in_card_icon_kind")
        .asEnum(["computer", "france", "question", "thumbs-up", "chat", "star"])
        .execute();

    // Create software_attribute_definitions table
    await db.schema
        .createTable("software_attribute_definitions")
        .addColumn("name", "text", col => col.primaryKey())
        .addColumn("kind", sql`attribute_kind`, col => col.notNull())
        .addColumn("label", "jsonb", col => col.notNull())
        .addColumn("description", "jsonb")
        .addColumn("displayInForm", "boolean", col => col.notNull().defaultTo(true))
        .addColumn("displayInDetails", "boolean", col => col.notNull().defaultTo(true))
        .addColumn("displayInCardIcon", sql`display_in_card_icon_kind`)
        .addColumn("enableFiltering", "boolean", col => col.notNull().defaultTo(false))
        .addColumn("required", "boolean", col => col.notNull().defaultTo(false))
        .addColumn("displayOrder", "integer", col => col.notNull().defaultTo(0))
        .addColumn("createdAt", "timestamptz", col => col.notNull().defaultTo(sql`NOW()`))
        .addColumn("updatedAt", "timestamptz", col => col.notNull().defaultTo(sql`NOW()`))
        .execute();

    // Seed existing prerogatives as attribute definitions
    await db
        .insertInto("software_attribute_definitions")
        .values([
            {
                name: "isPresentInSupportContract",
                kind: sql`'boolean'::attribute_kind`,
                label: sql`'{"en": "Present in support contract", "fr": "Présent dans le marché de support"}'::jsonb`,
                description: sql`'{"en": "The DGFIP manages two inter-ministerial markets: support (Atos) and expertise (multiple contractors) for open-source software, covering maintenance, monitoring, and expert services. https://code.gouv.fr/fr/utiliser/marches-interministeriels-support-expertise-logiciels-libres", "fr": "La DGFIP pilote deux marchés interministériels : support (Atos) et expertise (plusieurs titulaires) pour logiciels libres, couvrant maintenance, veille et prestations d’expertise. https://code.gouv.fr/fr/utiliser/marches-interministeriels-support-expertise-logiciels-libres"}'::jsonb`,
                displayInForm: true,
                displayInDetails: true,
                displayInCardIcon: "question",
                enableFiltering: true,
                required: true,
                displayOrder: 1
            },
            {
                name: "isFromFrenchPublicService",
                kind: sql`'boolean'::attribute_kind`,
                label: sql`'{"en": "Software developed by French public services", "fr": "Logiciel développé par les services publics français"}'::jsonb`,
                displayInForm: true,
                displayInDetails: true,
                displayInCardIcon: "france",
                enableFiltering: true,
                required: true,
                displayOrder: 2
            },
            {
                name: "doRespectRgaa",
                kind: sql`'boolean'::attribute_kind`,
                label: sql`'{"en": "RGAA compliant", "fr": "Respecte les normes RGAA"}'::jsonb`,
                description: sql`'{"en": "Référentiel général d’amélioration de l’accessibilité. Details on : https://accessibilite.numerique.gouv.fr", "fr": "Référentiel général d’amélioration de l’accessibilité. La DINUM édite ce référentiel général d’amélioration de l’accessibilité. Détails sur : https://accessibilite.numerique.gouv.fr"}'::jsonb`,
                displayInForm: true,
                displayInDetails: true,
                displayInCardIcon: null,
                enableFiltering: true,
                required: false,
                displayOrder: 3
            }
        ])
        .execute();

    // Add customAttributes column to softwares
    await db.schema
        .alterTable("softwares")
        .addColumn("customAttributes", "jsonb", col => col.notNull().defaultTo(sql`'{}'::jsonb`))
        .execute();

    // Migrate existing data to customAttributes
    await db
        .updateTable("softwares")
        .set({
            customAttributes: sql`jsonb_build_object(
                'isPresentInSupportContract', "isPresentInSupportContract",
                'isFromFrenchPublicService', "isFromFrenchPublicService",
                'doRespectRgaa', "doRespectRgaa"
            )`
        })
        .execute();

    // Create GIN index for efficient JSONB queries
    await sql`CREATE INDEX softwares_customAttributes_idx ON softwares USING GIN ("customAttributes")`.execute(db);

    // Drop old columns
    await db.schema
        .alterTable("softwares")
        .dropColumn("isPresentInSupportContract")
        .dropColumn("isFromFrenchPublicService")
        .dropColumn("doRespectRgaa")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Restore old columns
    await db.schema
        .alterTable("softwares")
        .addColumn("isPresentInSupportContract", "boolean", col => col.notNull().defaultTo(false))
        .addColumn("isFromFrenchPublicService", "boolean", col => col.notNull().defaultTo(false))
        .addColumn("doRespectRgaa", "boolean")
        .execute();

    // Migrate data back
    await db
        .updateTable("softwares")
        .set({
            isPresentInSupportContract: sql`COALESCE(("customAttributes"->>'isPresentInSupportContract')::boolean, false)`,
            isFromFrenchPublicService: sql`COALESCE(("customAttributes"->>'isFromFrenchPublicService')::boolean, false)`,
            doRespectRgaa: sql`("customAttributes"->>'doRespectRgaa')::boolean`
        })
        .execute();

    // Drop index (by name)
    await db.schema.dropIndex("softwares_customAttributes_idx").ifExists().execute();

    // Drop customAttributes column
    await db.schema.alterTable("softwares").dropColumn("customAttributes").execute();

    // Drop tables and types
    await db.schema.dropTable("software_attribute_definitions").execute();
    await db.schema.dropType("attribute_kind").execute();
    await db.schema.dropType("display_in_card_icon_kind").execute();
}
