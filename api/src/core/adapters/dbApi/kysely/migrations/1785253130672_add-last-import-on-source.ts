import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("sources").addColumn("lastImport", "timestamptz").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("sources").dropColumn("lastImport").execute();
}
