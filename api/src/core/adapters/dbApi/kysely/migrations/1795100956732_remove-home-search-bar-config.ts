// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await sql`update "config_ui" set "config" = "config" #- '{home,searchBar}'`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`update "config_ui" set "config" = jsonb_set("config", '{home,searchBar}', '{"enabled": false}')`.execute(
        db
    );
}
