// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await sql`alter table softwares add column if not exists "protections" jsonb`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`alter table softwares drop column if exists "protections"`.execute(db);
}
