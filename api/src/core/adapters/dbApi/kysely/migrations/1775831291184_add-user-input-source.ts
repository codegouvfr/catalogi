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

    // 2b. Allow name and description to be NULL so UserInput rows can omit non-overridden values.
    await db.schema
        .alterTable("software_external_datas")
        .alterColumn("name", col => col.dropNotNull())
        .execute();
    await db.schema
        .alterTable("software_external_datas")
        .alterColumn("description", col => col.dropNotNull())
        .execute();

    // 3. Backfill: for every existing software, create a UserInput row containing ONLY the
    // fields where the software's value differs from the best external source (lowest priority).
    // Fields that match the external source are set to NULL so the external data shows through
    // during merge (first-wins semantics). This ensures UserInput only overrides user edits.
    //
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
            '[]'::jsonb,
            -- ext.name may be a full LocalizedString like {"en":"...","fr":"..."}, so we
            -- compare only the 'fr' key to detect actual user edits.
            CASE WHEN s.name IS DISTINCT FROM (ext.name::jsonb ->> 'fr') THEN jsonb_build_object('fr', s.name) ELSE NULL END,
            CASE WHEN (s.description::jsonb ->> 'fr') IS DISTINCT FROM (ext.description::jsonb ->> 'fr') THEN s.description ELSE NULL END,
            CASE WHEN s."isLibreSoftware" IS DISTINCT FROM ext."isLibreSoftware" THEN s."isLibreSoftware" ELSE NULL END,
            CASE WHEN s.image IS DISTINCT FROM ext.image THEN s.image ELSE NULL END,
            CASE WHEN s.url IS DISTINCT FROM ext.url THEN s.url ELSE NULL END,
            CASE WHEN s."codeRepositoryUrl" IS DISTINCT FROM ext."codeRepositoryUrl" THEN s."codeRepositoryUrl" ELSE NULL END,
            CASE WHEN s."softwareHelp" IS DISTINCT FROM ext."softwareHelp" THEN s."softwareHelp" ELSE NULL END,
            CASE WHEN (ext.license IS NULL OR ext.license = '') AND s.license IS NOT NULL AND s.license != '' THEN s.license ELSE NULL END,
            CASE WHEN s."latestVersion" IS DISTINCT FROM ext."latestVersion" THEN s."latestVersion" ELSE NULL END,
            CASE WHEN s.keywords IS DISTINCT FROM ext.keywords THEN s.keywords ELSE NULL END,
            CASE WHEN s."programmingLanguages" IS DISTINCT FROM ext."programmingLanguages" THEN s."programmingLanguages" ELSE NULL END,
            CASE WHEN s."applicationCategories" IS DISTINCT FROM ext."applicationCategories" THEN s."applicationCategories" ELSE NULL END,
            CASE WHEN s."operatingSystems" IS DISTINCT FROM ext."operatingSystems" THEN s."operatingSystems" ELSE NULL END,
            CASE WHEN s."runtimePlatforms" IS DISTINCT FROM ext."runtimePlatforms" THEN s."runtimePlatforms" ELSE NULL END,
            NOW()
        FROM softwares s
        LEFT JOIN LATERAL (
            SELECT sed.*
            FROM software_external_datas sed
            JOIN sources src ON src.slug = sed."sourceSlug"
            WHERE sed."softwareId" = s.id
              AND src.kind != 'UserInput'
            ORDER BY src.priority ASC
            LIMIT 1
        ) ext ON true
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

    // Backfill from UserInput + best external source (UserInput rows may have NULLs for
    // non-overridden fields, so we COALESCE with the best external source to reconstruct
    // the full values that the softwares table originally held).
    await sql`
        UPDATE softwares s SET
            description = COALESCE(ui.description, best.description),
            license = COALESCE(ui.license, best.license, ''),
            image = COALESCE(ui.image, best.image),
            keywords = COALESCE(ui.keywords, best.keywords, '[]'::jsonb),
            "operatingSystems" = COALESCE(ui."operatingSystems", best."operatingSystems", '{}'::jsonb),
            "runtimePlatforms" = COALESCE(ui."runtimePlatforms", best."runtimePlatforms", '[]'::jsonb),
            "applicationCategories" = COALESCE(ui."applicationCategories", best."applicationCategories", '[]'::jsonb),
            "isLibreSoftware" = COALESCE(ui."isLibreSoftware", best."isLibreSoftware"),
            url = COALESCE(ui.url, best.url),
            "codeRepositoryUrl" = COALESCE(ui."codeRepositoryUrl", best."codeRepositoryUrl"),
            "softwareHelp" = COALESCE(ui."softwareHelp", best."softwareHelp"),
            "latestVersion" = COALESCE(ui."latestVersion", best."latestVersion"),
            "programmingLanguages" = COALESCE(ui."programmingLanguages", best."programmingLanguages")
        FROM software_external_datas ui
        LEFT JOIN LATERAL (
            SELECT sed.*
            FROM software_external_datas sed
            JOIN sources src ON src.slug = sed."sourceSlug"
            WHERE sed."softwareId" = s.id
              AND src.kind != 'UserInput'
            ORDER BY src.priority ASC
            LIMIT 1
        ) best ON true
        WHERE ui."softwareId" = s.id AND ui."sourceSlug" = 'UserInput'
    `.execute(db);

    // Restore NOT NULL on name and description
    await db.schema
        .alterTable("software_external_datas")
        .alterColumn("name", col => col.setNotNull())
        .execute();
    await db.schema
        .alterTable("software_external_datas")
        .alterColumn("description", col => col.setNotNull())
        .execute();

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
