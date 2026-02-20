// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("software_external_datas").renameColumn("label", "name").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("developers", "authors").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("websiteUrl", "url").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("sourceUrl", "codeRepositoryUrl").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("documentationUrl", "softwareHelp").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("logoUrl", "image").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("publicationTime", "dateCreated").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("softwareVersion", "latestVersion").execute();

    // latestVersion was a plain text column (softwareVersion).
    // Convert to jsonb: { "version": <old_value>, "releaseDate": null }
    await sql`
        ALTER TABLE software_external_datas
        ALTER COLUMN "latestVersion" TYPE jsonb
        USING CASE
            WHEN "latestVersion" IS NOT NULL
            THEN jsonb_build_object('version', "latestVersion"::text, 'releaseDate', NULL)
            ELSE NULL
        END
    `.execute(db);

    await db.schema.alterTable("software_external_datas").addColumn("operatingSystems", "jsonb").execute();

    await db.schema.alterTable("software_external_datas").addColumn("runtimePlatforms", "jsonb").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("software_external_datas").dropColumn("runtimePlatforms").execute();

    await db.schema.alterTable("software_external_datas").dropColumn("operatingSystems").execute();

    // Convert latestVersion jsonb back to text (softwareVersion)
    await sql`
        ALTER TABLE software_external_datas
        ALTER COLUMN "latestVersion" TYPE text
        USING CASE
            WHEN "latestVersion" IS NOT NULL
            THEN "latestVersion"->>'version'
            ELSE NULL
        END
    `.execute(db);

    await db.schema.alterTable("software_external_datas").renameColumn("latestVersion", "softwareVersion").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("dateCreated", "publicationTime").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("image", "logoUrl").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("softwareHelp", "documentationUrl").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("codeRepositoryUrl", "sourceUrl").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("url", "websiteUrl").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("authors", "developers").execute();

    await db.schema.alterTable("software_external_datas").renameColumn("name", "label").execute();
}
