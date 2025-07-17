// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("user_sessions")
        .addColumn("id", "uuid", col => col.primaryKey())
        .addColumn("state", "text", col => col.notNull())
        .addColumn("redirectUrl", "text")
        .addColumn("userId", "integer", col => col.references("users.id").onDelete("cascade"))
        .addColumn("email", "text")
        .addColumn("accessToken", "text")
        .addColumn("refreshToken", "text")
        .addColumn("expiresAt", "timestamptz")
        .addColumn("createdAt", "timestamptz", col => col.notNull().defaultTo("now()"))
        .addColumn("updatedAt", "timestamptz", col => col.notNull().defaultTo("now()"))
        .addColumn("loggedOutAt", "timestamptz")
        .execute();

    await db.schema.createIndex("sessions_state_idx").on("user_sessions").column("state").execute();

    await db.schema.createIndex("sessions_userId_idx").on("user_sessions").column("userId").execute();

    await db.schema.createIndex("sessions_expiresAt_idx").on("user_sessions").column("expiresAt").execute();

    await db.schema
        .alterTable("users")
        .addColumn("sub", "text")
        .addColumn("firstName", "text")
        .addColumn("lastName", "text")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("users").dropColumn("sub").dropColumn("firstName").dropColumn("lastName").execute();

    await db.schema.dropTable("user_sessions").execute();
}
