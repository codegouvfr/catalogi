// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import { UiConfigRepository } from "../../../ports/DbApiV2";
import { Database } from "./kysely.database";

export const createPgUiConfigRepository = (db: Kysely<Database>): UiConfigRepository => ({
    get: async () => {
        const row = await db.selectFrom("config_ui").select("config").where("id", "=", true).executeTakeFirst();
        return row?.config ?? undefined;
    },
    save: async config => {
        await db
            .insertInto("config_ui")
            .values({ id: true, config: JSON.stringify(config) })
            .onConflict(oc => oc.column("id").doUpdateSet({ config: JSON.stringify(config), updatedAt: sql`now()` }))
            .execute();
    }
});
