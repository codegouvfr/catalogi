import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await sql`ALTER TABLE softwares RENAME COLUMN "logoUrl" TO image`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`ALTER TABLE softwares RENAME COLUMN image TO "logoUrl"`.execute(db);
}
