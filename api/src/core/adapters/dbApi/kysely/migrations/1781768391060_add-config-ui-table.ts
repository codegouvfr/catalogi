// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";

// Singleton table holding the UI configuration as a single jsonb document.
// The row is seeded at application bootstrap (seed-if-empty) from the currently
// loaded ui-config.json so existing deployments keep their customization; this
// migration only creates the empty table.
export async function up(db: Kysely<any>): Promise<void> {
    await sql`
        create table if not exists "config_ui" (
            "id" boolean primary key default true,
            "config" jsonb not null,
            "createdAt" timestamptz not null default now(),
            "updatedAt" timestamptz not null default now(),
            constraint "config_ui_singleton" check ("id")
        )
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`drop table if exists "config_ui"`.execute(db);
}
