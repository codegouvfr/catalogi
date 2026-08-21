// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import { UiConfigRepository } from "../../../ports/DbApiV2";
import { uiConfigSchema } from "../../../uiConfigSchema";
import { Database } from "./kysely.database";

export const createPgUiConfigRepository = (db: Kysely<Database>): UiConfigRepository => ({
    get: async () => {
        const row = await db.selectFrom("config_ui").select("config").where("id", "=", true).executeTakeFirst();
        if (row === undefined) {
            throw new Error(
                "UI configuration is missing from PostgreSQL. The config_ui migration must create its singleton row."
            );
        }

        const result = uiConfigSchema.safeParse(row.config);
        if (!result.success) {
            throw new Error(`UI configuration stored in PostgreSQL is invalid: ${result.error.message}`);
        }

        return result.data;
    },
    save: async config => {
        const result = await db
            .updateTable("config_ui")
            .set({ config: JSON.stringify(config), updatedAt: sql`now()` })
            .where("id", "=", true)
            .executeTakeFirst();

        if (result.numUpdatedRows !== BigInt(1)) {
            throw new Error("Cannot save UI configuration because its PostgreSQL singleton row is missing.");
        }
    }
});
