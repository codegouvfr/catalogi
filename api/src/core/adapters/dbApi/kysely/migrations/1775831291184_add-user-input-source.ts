// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { sql, type Kysely } from "kysely";
import rawUiConfig from "../../../../../customization/ui-config.json";

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
    // 1. Add "user_input" to the Postgres enum backing `sources.kind`.
    // ALTER TYPE ADD VALUE can't run inside a transaction, so we follow the existing
    // drop/recreate pattern used by earlier migrations (see 1769773451027_add-repo-metadata).
    await db.schema
        .alterTable("sources")
        .alterColumn("kind", col => col.setDataType("text"))
        .execute();

    await db.schema.dropType("external_data_origin_type").execute();
    await db.schema
        .createType("external_data_origin_type")
        .asEnum(["wikidata", "HAL", "ComptoirDuLibre", "CNLL", "Zenodo", "GitLab", "GitHub", "user_input"])
        .execute();

    await db.schema
        .alterTable("sources")
        .alterColumn("kind", col =>
            col.setDataType(sql`external_data_origin_type USING kind::external_data_origin_type`)
        )
        .execute();

    // 2. Per-deployment opt-in: if neither edit nor add is enabled, stop here.
    const userInputEnabled =
        rawUiConfig?.home?.usecases?.editSoftware?.enabled ||
        rawUiConfig?.home?.usecases?.addSoftwareOrService?.enabled;

    if (!userInputEnabled) return;

    // 3. Seed the user_input source row. Existing convention is lower priority number = higher
    // precedence (wikidata=1, cdl=2, cnll=3). We pick MIN(existing) - 1 so user_input wins by
    // default; admins can re-rank via the sources table if they want an external source to take
    // precedence.
    await sql`
        INSERT INTO sources (slug, kind, url, priority, description)
        SELECT 'user_input', 'user_input', '', COALESCE(MIN(priority), 1) - 1, NULL
        FROM sources
    `.execute(db);

    // 4. Backfill: for every existing software, copy its content columns into a user_input row.
    // The `externalId` column is part of the primary key on `software_external_datas`, so it
    // can't be NULL — we use `softwareId::text` as a stable sentinel that's unique per software
    // within the `user_input` source. Refresh/import jobs skip `kind='user_input'` so this
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
            s.id::text, 'user_input', s.id,
            '[]'::jsonb, jsonb_build_object('fr', s.name), s.description,
            s."isLibreSoftware", s.image, s.url, s."codeRepositoryUrl", s."softwareHelp",
            s.license, s."latestVersion", s.keywords, s."programmingLanguages",
            s."applicationCategories", s."operatingSystems", s."runtimePlatforms",
            NOW()
        FROM softwares s
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DELETE FROM software_external_datas WHERE "sourceSlug" = 'user_input'`.execute(db);
    await sql`DELETE FROM sources WHERE slug = 'user_input'`.execute(db);

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
