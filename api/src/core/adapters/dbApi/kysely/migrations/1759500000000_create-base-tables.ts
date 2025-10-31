// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Check if this is an existing database by looking for the user_sessions table
    const { rows } = await sql<{ exists: boolean }>`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'user_sessions'
        ) as exists
    `.execute(db);

    const isExistingDatabase = rows[0]?.exists;

    if (isExistingDatabase) {
        // For existing databases, schema already exists, nothing to do
        console.log("Existing database detected. Schema already exists, skipping creation.");
        return;
    }

    // For new databases, create the complete schema
    console.log("New database detected. Creating complete schema...");

    // Create enum type
    await db.schema
        .createType("external_data_origin_type")
        .asEnum(["wikidata", "HAL", "ComptoirDuLibre", "CNLL", "Zenodo"])
        .execute();

    // Create users table (formerly agents)
    await db.schema
        .createTable("users")
        .addColumn("id", "serial", col => col.primaryKey())
        .addColumn("email", "text", col => col.notNull())
        .addColumn("organization", "text")
        .addColumn("about", "text")
        .addColumn("isPublic", "boolean", col => col.notNull())
        .addColumn("createdAt", "timestamptz")
        .addColumn("updatedAt", "timestamptz")
        .addColumn("sub", "text")
        .addColumn("firstName", "text")
        .addColumn("lastName", "text")
        .execute();

    // Create softwares table
    await db.schema
        .createTable("softwares")
        .addColumn("id", "serial", col => col.primaryKey())
        .addColumn("softwareType", "jsonb", col => col.notNull())
        .addColumn("name", "text", col => col.unique().notNull())
        .addColumn("description", "text", col => col.notNull())
        .addColumn("license", "text", col => col.notNull())
        .addColumn("versionMin", "text")
        .addColumn("isPresentInSupportContract", "boolean", col => col.notNull())
        .addColumn("isFromFrenchPublicService", "boolean", col => col.notNull())
        .addColumn("logoUrl", "text")
        .addColumn("keywords", "jsonb", col => col.notNull())
        .addColumn("doRespectRgaa", "boolean")
        .addColumn("isStillInObservation", "boolean", col => col.notNull())
        .addColumn("workshopUrls", "jsonb", col => col.notNull())
        .addColumn("categories", "jsonb", col => col.notNull())
        .addColumn("generalInfoMd", "text")
        .addColumn("addedByUserId", "integer", col => col.notNull().references("users.id"))
        .addColumn("dereferencing", "jsonb")
        .addColumn("referencedSinceTime", "timestamptz", col => col.notNull())
        .addColumn("updateTime", "timestamptz", col => col.notNull())
        .execute();

    // Create sources table
    await db.schema
        .createTable("sources")
        .addColumn("slug", "text", col => col.primaryKey())
        .addColumn("kind", sql`external_data_origin_type`, col => col.notNull())
        .addColumn("url", "text", col => col.notNull())
        .addColumn("priority", "integer", col => col.unique().notNull())
        .addColumn("description", "jsonb")
        .execute();

    // Create software_external_datas table
    await db.schema
        .createTable("software_external_datas")
        .addColumn("externalId", "text", col => col.notNull())
        .addColumn("sourceSlug", "text", col => col.notNull().references("sources.slug").onDelete("cascade"))
        .addColumn("softwareId", "integer", col => col.references("softwares.id").onDelete("cascade"))
        .addColumn("developers", "jsonb", col => col.notNull())
        .addColumn("label", "jsonb", col => col.notNull())
        .addColumn("description", "jsonb", col => col.notNull())
        .addColumn("isLibreSoftware", "boolean")
        .addColumn("logoUrl", "text")
        .addColumn("websiteUrl", "text")
        .addColumn("sourceUrl", "text")
        .addColumn("documentationUrl", "text")
        .addColumn("license", "text")
        .addColumn("softwareVersion", "text")
        .addColumn("publicationTime", "timestamptz")
        .addColumn("keywords", "jsonb")
        .addColumn("programmingLanguages", "jsonb")
        .addColumn("applicationCategories", "jsonb")
        .addColumn("referencePublications", "jsonb")
        .addColumn("identifiers", "jsonb")
        .addColumn("lastDataFetchAt", "timestamptz")
        .addColumn("providers", "jsonb")
        .addPrimaryKeyConstraint("software_external_datas_pkey", ["externalId", "sourceSlug"])
        .addUniqueConstraint("uniq_source_external_id", ["sourceSlug", "externalId", "softwareId"])
        .execute();

    // Create softwares__similar_software_external_datas table
    await db.schema
        .createTable("softwares__similar_software_external_datas")
        .addColumn("softwareId", "integer", col => col.notNull().references("softwares.id").onDelete("cascade"))
        .addColumn("similarExternalId", "text", col => col.notNull())
        .addColumn("sourceSlug", "text", col => col.notNull())
        .addPrimaryKeyConstraint("softwares__similar_software_external_datas_pkey", [
            "softwareId",
            "similarExternalId",
            "sourceSlug"
        ])
        .addForeignKeyConstraint(
            "softwares__similar_software_external_datas_software_external_da",
            ["similarExternalId", "sourceSlug"],
            "software_external_datas",
            ["externalId", "sourceSlug"],
            cb => cb.onDelete("cascade")
        )
        .execute();

    // Create software_users table
    await db.schema
        .createTable("software_users")
        .addColumn("softwareId", "integer", col => col.notNull().references("softwares.id").onDelete("cascade"))
        .addColumn("userId", "integer", col => col.notNull().references("users.id").onDelete("cascade"))
        .addColumn("useCaseDescription", "text", col => col.notNull())
        .addColumn("os", "text")
        .addColumn("version", "text", col => col.notNull())
        .addColumn("serviceUrl", "text")
        .execute();

    // Create software_referents table
    await db.schema
        .createTable("software_referents")
        .addColumn("softwareId", "integer", col => col.notNull().references("softwares.id").onDelete("cascade"))
        .addColumn("userId", "integer", col => col.notNull().references("users.id").onDelete("cascade"))
        .addColumn("useCaseDescription", "text", col => col.notNull())
        .addColumn("isExpert", "boolean", col => col.notNull())
        .addColumn("serviceUrl", "text")
        .execute();

    // Create instances table
    await db.schema
        .createTable("instances")
        .addColumn("id", "serial", col => col.primaryKey())
        .addColumn("mainSoftwareSillId", "integer", col => col.notNull().references("softwares.id").onDelete("cascade"))
        .addColumn("addedByUserId", "integer", col => col.notNull().references("users.id"))
        .addColumn("organization", "text", col => col.notNull())
        .addColumn("targetAudience", "text", col => col.notNull())
        .addColumn("instanceUrl", "text")
        .addColumn("isPublic", "boolean", col => col.notNull())
        .addColumn("referencedSinceTime", "timestamptz", col => col.notNull())
        .addColumn("updateTime", "timestamptz", col => col.notNull())
        .execute();

    // Create user_sessions table
    await db.schema
        .createTable("user_sessions")
        .addColumn("id", "uuid", col => col.primaryKey())
        .addColumn("state", "text", col => col.notNull())
        .addColumn("redirectUrl", "text")
        .addColumn("userId", "integer", col => col.references("users.id").onDelete("cascade"))
        .addColumn("email", "text")
        .addColumn("accessToken", "text")
        .addColumn("refreshToken", "text")
        .addColumn("idToken", "text")
        .addColumn("expiresAt", "timestamptz")
        .addColumn("createdAt", "timestamptz", col => col.notNull().defaultTo(sql`now()`))
        .addColumn("updatedAt", "timestamptz", col => col.notNull().defaultTo(sql`now()`))
        .addColumn("loggedOutAt", "timestamptz")
        .execute();

    // Create indexes
    await db.schema
        .createIndex("instances_mainSoftwareSillId_idx")
        .on("instances")
        .column("mainSoftwareSillId")
        .execute();

    await db.schema.createIndex("sessions_state_idx").on("user_sessions").column("state").execute();
    await db.schema.createIndex("sessions_userId_idx").on("user_sessions").column("userId").execute();
    await db.schema.createIndex("sessions_expiresAt_idx").on("user_sessions").column("expiresAt").execute();

    await db.schema
        .createIndex("softwareReferents_software_idx")
        .on("software_referents")
        .column("softwareId")
        .execute();
    await db.schema.createIndex("softwareUsers_software_idx").on("software_users").column("softwareId").execute();

    await db.schema
        .createIndex("softwares_similarExternalId_idx")
        .on("softwares__similar_software_external_datas")
        .column("similarExternalId")
        .execute();
    await db.schema
        .createIndex("softwares_similarSoftwareId_idx")
        .on("softwares__similar_software_external_datas")
        .column("softwareId")
        .execute();

    console.log("Schema created successfully.");
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop tables in reverse order (respecting foreign key constraints)
    await db.schema.dropTable("user_sessions").ifExists().execute();
    await db.schema.dropTable("instances").ifExists().execute();
    await db.schema.dropTable("software_referents").ifExists().execute();
    await db.schema.dropTable("software_users").ifExists().execute();
    await db.schema.dropTable("softwares__similar_software_external_datas").ifExists().execute();
    await db.schema.dropTable("software_external_datas").ifExists().execute();
    await db.schema.dropTable("softwares").ifExists().execute();
    await db.schema.dropTable("sources").ifExists().execute();
    await db.schema.dropTable("users").ifExists().execute();
    await db.schema.dropType("external_data_origin_type").ifExists().execute();
}
