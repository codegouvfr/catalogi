import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("software_external_datas").addColumn("repoMetadata", "jsonb").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("software_external_datas").dropColumn("repoMetadata").execute();
}
