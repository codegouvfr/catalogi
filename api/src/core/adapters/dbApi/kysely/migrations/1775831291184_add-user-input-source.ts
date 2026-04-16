// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { sql, type Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
    // 1. Add "UserInput" to the Postgres enum backing `sources.kind`.
    // ALTER TYPE ADD VALUE can't run inside a transaction, so we follow the existing
    // drop/recreate pattern used by earlier migrations (see 1769773451027_add-repo-metadata).
    await db.schema
        .alterTable("sources")
        .alterColumn("kind", col => col.setDataType("text"))
        .execute();

    await db.schema.dropType("external_data_origin_type").execute();
    await db.schema
        .createType("external_data_origin_type")
        .asEnum(["wikidata", "HAL", "ComptoirDuLibre", "CNLL", "Zenodo", "GitLab", "GitHub", "UserInput"])
        .execute();

    await db.schema
        .alterTable("sources")
        .alterColumn("kind", col =>
            col.setDataType(sql`external_data_origin_type USING kind::external_data_origin_type`)
        )
        .execute();

    // 2. Seed the UserInput source row. Existing convention is lower priority number = higher
    // precedence (wikidata=1, cdl=2, cnll=3). We pick MIN(existing) - 1 so UserInput wins by
    // default; admins can re-rank via the sources table if they want an external source to take
    // precedence.
    await sql`
        INSERT INTO sources (slug, kind, url, priority, description)
        SELECT 'UserInput', 'UserInput', '', COALESCE(MIN(priority), 1) - 1, NULL
        FROM sources
    `.execute(db);

    // 3. Backfill: for every existing software, copy its content columns into a UserInput row.
    // The `externalId` column is part of the primary key on `software_external_datas`, so it
    // can't be NULL — we use `softwareId::text` as a stable sentinel that's unique per software
    // within the `UserInput` source. Refresh/import jobs skip `kind='UserInput'` so this
    // sentinel never gets fed to an external gateway.
    await sql`
        INSERT INTO software_external_datas (
            "externalId", "sourceSlug", "softwareId",
            authors, name, description,
            "isLibreSoftware", image, url, "codeRepositoryUrl", "softwareHelp",
            license, "latestVersion", keywords, "programmingLanguages",
            "applicationCategories", "operatingSystems", "runtimePlatforms",
            "lastDataFetchAt"
        )
        SELECT
            s.id::text, 'UserInput', s.id,
            '[]'::jsonb, jsonb_build_object('fr', s.name), s.description,
            s."isLibreSoftware", s.image, s.url, s."codeRepositoryUrl", s."softwareHelp",
            s.license, s."latestVersion", s.keywords, s."programmingLanguages",
            s."applicationCategories", s."operatingSystems", s."runtimePlatforms",
            NOW()
        FROM softwares s
    `.execute(db);

    // 4. Drop content columns from `softwares` — data now lives in `software_external_datas`.
    await sql`
        ALTER TABLE softwares
            DROP COLUMN description,
            DROP COLUMN license,
            DROP COLUMN image,
            DROP COLUMN keywords,
            DROP COLUMN "operatingSystems",
            DROP COLUMN "runtimePlatforms",
            DROP COLUMN "applicationCategories",
            DROP COLUMN "isLibreSoftware",
            DROP COLUMN url,
            DROP COLUMN "codeRepositoryUrl",
            DROP COLUMN "softwareHelp",
            DROP COLUMN "latestVersion",
            DROP COLUMN "programmingLanguages"
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    // Re-add content columns with correct types
    await db.schema.alterTable("softwares").addColumn("description", "jsonb").execute();
    await db.schema
        .alterTable("softwares")
        .addColumn("license", "text", col => col.defaultTo(""))
        .execute();
    await db.schema.alterTable("softwares").addColumn("image", "text").execute();
    await db.schema
        .alterTable("softwares")
        .addColumn("keywords", "jsonb", col => col.defaultTo("[]"))
        .execute();
    await db.schema
        .alterTable("softwares")
        .addColumn("operatingSystems", "jsonb", col => col.defaultTo("{}"))
        .execute();
    await db.schema
        .alterTable("softwares")
        .addColumn("runtimePlatforms", "jsonb", col => col.defaultTo("[]"))
        .execute();
    await db.schema
        .alterTable("softwares")
        .addColumn("applicationCategories", "jsonb", col => col.defaultTo("[]"))
        .execute();
    await db.schema.alterTable("softwares").addColumn("isLibreSoftware", "boolean").execute();
    await db.schema.alterTable("softwares").addColumn("url", "text").execute();
    await db.schema.alterTable("softwares").addColumn("codeRepositoryUrl", "text").execute();
    await db.schema.alterTable("softwares").addColumn("softwareHelp", "text").execute();
    await db.schema.alterTable("softwares").addColumn("latestVersion", "jsonb").execute();
    await db.schema.alterTable("softwares").addColumn("programmingLanguages", "jsonb").execute();

    // Backfill from UserInput source
    await sql`
        UPDATE softwares s SET
            description = ext.description,
            license = COALESCE(ext.license, ''),
            image = ext.image,
            keywords = COALESCE(ext.keywords, '[]'::jsonb),
            "operatingSystems" = COALESCE(ext."operatingSystems", '{}'::jsonb),
            "runtimePlatforms" = COALESCE(ext."runtimePlatforms", '[]'::jsonb),
            "applicationCategories" = COALESCE(ext."applicationCategories", '[]'::jsonb),
            "isLibreSoftware" = ext."isLibreSoftware",
            url = ext.url,
            "codeRepositoryUrl" = ext."codeRepositoryUrl",
            "softwareHelp" = ext."softwareHelp",
            "latestVersion" = ext."latestVersion",
            "programmingLanguages" = ext."programmingLanguages"
        FROM software_external_datas ext
        WHERE ext."softwareId" = s.id AND ext."sourceSlug" = 'UserInput'
    `.execute(db);

    // Remove UserInput rows and source
    await sql`DELETE FROM software_external_datas WHERE "sourceSlug" = 'UserInput'`.execute(db);
    await sql`DELETE FROM sources WHERE slug = 'UserInput'`.execute(db);

    await db.schema
        .alterTable("sources")
        .alterColumn("kind", col => col.setDataType("text"))
        .execute();

    await db.schema.dropType("external_data_origin_type").execute();
    await db.schema
        .createType("external_data_origin_type")
        .asEnum(["wikidata", "HAL", "ComptoirDuLibre", "CNLL", "Zenodo", "GitLab", "GitHub"])
        .execute();

    await db.schema
        .alterTable("sources")
        .alterColumn("kind", col =>
            col.setDataType(sql`external_data_origin_type USING kind::external_data_origin_type`)
        )
        .execute();
}
