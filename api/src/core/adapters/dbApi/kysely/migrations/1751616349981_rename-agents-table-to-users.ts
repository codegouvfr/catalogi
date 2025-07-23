// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("agents").renameTo("users").execute();

    await db.schema.alterTable("software_users").renameColumn("agentId", "userId").execute();
    await db.schema.alterTable("software_referents").renameColumn("agentId", "userId").execute();
    await db.schema.alterTable("softwares").renameColumn("addedByAgentId", "addedByUserId").execute();
    await db.schema.alterTable("instances").renameColumn("addedByAgentId", "addedByUserId").execute();

    await db.schema
        .alterTable("users")
        .addColumn("createdAt", "timestamptz")
        .addColumn("updatedAt", "timestamptz")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("users").dropColumn("createdAt").dropColumn("updatedAt").execute();

    await db.schema.alterTable("softwares").renameColumn("addedByUserId", "addedByAgentId").execute();
    await db.schema.alterTable("instances").renameColumn("addedByUserId", "addedByAgentId").execute();
    await db.schema.alterTable("software_users").renameColumn("userId", "agentId").execute();
    await db.schema.alterTable("software_referents").renameColumn("userId", "agentId").execute();

    await db.schema.alterTable("users").renameTo("agents").execute();
}
