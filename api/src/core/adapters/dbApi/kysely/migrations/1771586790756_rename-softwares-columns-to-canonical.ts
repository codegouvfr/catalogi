import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Rename referencedSinceTime → addedTime, convert timestamp → text ISO
    await db.schema.alterTable("softwares").addColumn("addedTime", "text").execute();
    await sql`UPDATE softwares SET "addedTime" = to_char("referencedSinceTime" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.execute(
        db
    );
    await db.schema
        .alterTable("softwares")
        .alterColumn("addedTime", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("referencedSinceTime").execute();

    // Convert updateTime timestamp → text ISO
    await db.schema.alterTable("softwares").addColumn("updateTimeText", "text").execute();
    await sql`UPDATE softwares SET "updateTimeText" = to_char("updateTime" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.execute(
        db
    );
    await db.schema
        .alterTable("softwares")
        .alterColumn("updateTimeText", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("updateTime").execute();
    await db.schema.alterTable("softwares").renameColumn("updateTimeText", "updateTime").execute();

    // Convert description text → jsonb (wrap existing text as JSON string)
    await db.schema.alterTable("softwares").addColumn("descriptionJsonb", "jsonb").execute();
    await sql`UPDATE softwares SET "descriptionJsonb" = to_jsonb(jsonb_build_object('fr', description))`.execute(db);
    await db.schema
        .alterTable("softwares")
        .alterColumn("descriptionJsonb", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("description").execute();
    await db.schema.alterTable("softwares").renameColumn("descriptionJsonb", "description").execute();

    // Rename categories → applicationCategories
    await db.schema.alterTable("softwares").renameColumn("categories", "applicationCategories").execute();

    // Decompose softwareType → operatingSystems + runtimePlatforms
    await db.schema.alterTable("softwares").addColumn("operatingSystems", "jsonb").execute();
    await db.schema.alterTable("softwares").addColumn("runtimePlatforms", "jsonb").execute();

    // Populate operatingSystems: desktop/mobile → os record, cloud/stack → empty record
    await sql`UPDATE softwares SET "operatingSystems" = CASE
        WHEN ("softwareType"->>'type') = 'desktop/mobile' THEN ("softwareType"->'os')
        ELSE '{}'::jsonb
    END`.execute(db);

    // Populate runtimePlatforms: desktop/mobile → ["desktop"], cloud → ["cloud"], stack → []
    await sql`UPDATE softwares SET "runtimePlatforms" = CASE
        WHEN ("softwareType"->>'type') = 'desktop/mobile' THEN '["desktop"]'::jsonb
        WHEN ("softwareType"->>'type') = 'cloud' THEN '["cloud"]'::jsonb
        ELSE '[]'::jsonb
    END`.execute(db);

    await db.schema
        .alterTable("softwares")
        .alterColumn("operatingSystems", col => col.setNotNull())
        .execute();
    await db.schema
        .alterTable("softwares")
        .alterColumn("runtimePlatforms", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("softwareType").execute();

    // Drop workshopUrls and generalInfoMd
    await db.schema.alterTable("softwares").dropColumn("workshopUrls").execute();
    await db.schema.alterTable("softwares").dropColumn("generalInfoMd").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Restore workshopUrls and generalInfoMd
    await db.schema
        .alterTable("softwares")
        .addColumn("workshopUrls", "jsonb", col => col.defaultTo("[]"))
        .execute();
    await db.schema.alterTable("softwares").addColumn("generalInfoMd", "text").execute();

    // Restore softwareType from operatingSystems + runtimePlatforms
    await db.schema.alterTable("softwares").addColumn("softwareType", "jsonb").execute();
    await sql`UPDATE softwares SET "softwareType" = CASE
        WHEN "runtimePlatforms" @> '["cloud"]'::jsonb THEN '{"type":"cloud"}'::jsonb
        WHEN "runtimePlatforms" @> '["desktop"]'::jsonb THEN jsonb_build_object('type', 'desktop/mobile', 'os', "operatingSystems")
        ELSE '{"type":"stack"}'::jsonb
    END`.execute(db);
    await db.schema
        .alterTable("softwares")
        .alterColumn("softwareType", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("operatingSystems").execute();
    await db.schema.alterTable("softwares").dropColumn("runtimePlatforms").execute();

    // Restore categories
    await db.schema.alterTable("softwares").renameColumn("applicationCategories", "categories").execute();

    // Restore description text from jsonb
    await db.schema.alterTable("softwares").addColumn("descriptionText", "text").execute();
    await sql`UPDATE softwares SET "descriptionText" = COALESCE(description->>'fr', '')`.execute(db);
    await db.schema
        .alterTable("softwares")
        .alterColumn("descriptionText", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("description").execute();
    await db.schema.alterTable("softwares").renameColumn("descriptionText", "description").execute();

    // Restore updateTime as timestamp
    await db.schema.alterTable("softwares").addColumn("updateTimeTs", "timestamp").execute();
    await sql`UPDATE softwares SET "updateTimeTs" = "updateTime"::timestamptz`.execute(db);
    await db.schema
        .alterTable("softwares")
        .alterColumn("updateTimeTs", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("updateTime").execute();
    await db.schema.alterTable("softwares").renameColumn("updateTimeTs", "updateTime").execute();

    // Restore referencedSinceTime as timestamp
    await db.schema.alterTable("softwares").addColumn("referencedSinceTime", "timestamp").execute();
    await sql`UPDATE softwares SET "referencedSinceTime" = "addedTime"::timestamptz`.execute(db);
    await db.schema
        .alterTable("softwares")
        .alterColumn("referencedSinceTime", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("addedTime").execute();
}
