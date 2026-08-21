// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";

// Singleton table holding the UI configuration as a single jsonb document. Bootstrap
// initializes the row once from ui-config.json so existing deployments keep their setup.
export async function up(db: Kysely<any>): Promise<void> {
    await sql`
        create table "config_ui" (
            "id" boolean primary key default true,
            "config" jsonb not null,
            "createdAt" timestamptz not null default now(),
            "updatedAt" timestamptz not null default now(),
            constraint "config_ui_singleton" check ("id")
        )
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`drop table "config_ui"`.execute(db);
}
