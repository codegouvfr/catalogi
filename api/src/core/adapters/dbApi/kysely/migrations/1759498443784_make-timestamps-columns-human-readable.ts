// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("softwares").addColumn("referencedSinceTime_temp", "timestamptz").execute();
    await sql`UPDATE softwares SET "referencedSinceTime_temp" = to_timestamp("referencedSinceTime" / 1000.0)`.execute(
        db
    );
    await db.schema
        .alterTable("softwares")
        .alterColumn("referencedSinceTime_temp", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("referencedSinceTime").execute();
    await db.schema.alterTable("softwares").renameColumn("referencedSinceTime_temp", "referencedSinceTime").execute();

    await db.schema.alterTable("softwares").addColumn("updateTime_temp", "timestamptz").execute();
    await sql`UPDATE softwares SET "updateTime_temp" = to_timestamp("updateTime" / 1000.0)`.execute(db);
    await db.schema
        .alterTable("softwares")
        .alterColumn("updateTime_temp", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("updateTime").execute();
    await db.schema.alterTable("softwares").renameColumn("updateTime_temp", "updateTime").execute();

    await db.schema.alterTable("instances").addColumn("referencedSinceTime_temp", "timestamptz").execute();
    await sql`UPDATE instances SET "referencedSinceTime_temp" = to_timestamp("referencedSinceTime" / 1000.0)`.execute(
        db
    );
    await db.schema
        .alterTable("instances")
        .alterColumn("referencedSinceTime_temp", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("instances").dropColumn("referencedSinceTime").execute();
    await db.schema.alterTable("instances").renameColumn("referencedSinceTime_temp", "referencedSinceTime").execute();

    await db.schema.alterTable("instances").addColumn("updateTime_temp", "timestamptz").execute();
    await sql`UPDATE instances SET "updateTime_temp" = to_timestamp("updateTime" / 1000.0)`.execute(db);
    await db.schema
        .alterTable("instances")
        .alterColumn("updateTime_temp", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("instances").dropColumn("updateTime").execute();
    await db.schema.alterTable("instances").renameColumn("updateTime_temp", "updateTime").execute();

    await db.schema.alterTable("software_external_datas").addColumn("lastDataFetchAt_temp", "timestamptz").execute();
    await sql`UPDATE software_external_datas SET "lastDataFetchAt_temp" = to_timestamp("lastDataFetchAt" / 1000.0) WHERE "lastDataFetchAt" IS NOT NULL`.execute(
        db
    );
    await db.schema.alterTable("software_external_datas").dropColumn("lastDataFetchAt").execute();
    await db.schema
        .alterTable("software_external_datas")
        .renameColumn("lastDataFetchAt_temp", "lastDataFetchAt")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("softwares").addColumn("referencedSinceTime_temp", "bigint").execute();
    await sql`UPDATE softwares SET "referencedSinceTime_temp" = EXTRACT(EPOCH FROM "referencedSinceTime")::bigint * 1000`.execute(
        db
    );
    await db.schema
        .alterTable("softwares")
        .alterColumn("referencedSinceTime_temp", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("referencedSinceTime").execute();
    await db.schema.alterTable("softwares").renameColumn("referencedSinceTime_temp", "referencedSinceTime").execute();

    await db.schema.alterTable("softwares").addColumn("updateTime_temp", "bigint").execute();
    await sql`UPDATE softwares SET "updateTime_temp" = EXTRACT(EPOCH FROM "updateTime")::bigint * 1000`.execute(db);
    await db.schema
        .alterTable("softwares")
        .alterColumn("updateTime_temp", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("softwares").dropColumn("updateTime").execute();
    await db.schema.alterTable("softwares").renameColumn("updateTime_temp", "updateTime").execute();

    await db.schema.alterTable("instances").addColumn("referencedSinceTime_temp", "bigint").execute();
    await sql`UPDATE instances SET "referencedSinceTime_temp" = EXTRACT(EPOCH FROM "referencedSinceTime")::bigint * 1000`.execute(
        db
    );
    await db.schema
        .alterTable("instances")
        .alterColumn("referencedSinceTime_temp", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("instances").dropColumn("referencedSinceTime").execute();
    await db.schema.alterTable("instances").renameColumn("referencedSinceTime_temp", "referencedSinceTime").execute();

    await db.schema.alterTable("instances").addColumn("updateTime_temp", "bigint").execute();
    await sql`UPDATE instances SET "updateTime_temp" = EXTRACT(EPOCH FROM "updateTime")::bigint * 1000`.execute(db);
    await db.schema
        .alterTable("instances")
        .alterColumn("updateTime_temp", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("instances").dropColumn("updateTime").execute();
    await db.schema.alterTable("instances").renameColumn("updateTime_temp", "updateTime").execute();

    await db.schema.alterTable("software_external_datas").addColumn("lastDataFetchAt_temp", "bigint").execute();
    await sql`UPDATE software_external_datas SET "lastDataFetchAt_temp" = EXTRACT(EPOCH FROM "lastDataFetchAt")::bigint * 1000 WHERE "lastDataFetchAt" IS NOT NULL`.execute(
        db
    );
    await db.schema.alterTable("software_external_datas").dropColumn("lastDataFetchAt").execute();
    await db.schema
        .alterTable("software_external_datas")
        .renameColumn("lastDataFetchAt_temp", "lastDataFetchAt")
        .execute();
}
