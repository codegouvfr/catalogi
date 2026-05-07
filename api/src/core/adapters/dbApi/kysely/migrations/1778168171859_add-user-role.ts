import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("users")
        .addColumn("role", "text", col => col.notNull().defaultTo("user"))
        .execute();

    await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`.execute(db);
    await db.schema.alterTable("users").dropColumn("role").execute();
}
