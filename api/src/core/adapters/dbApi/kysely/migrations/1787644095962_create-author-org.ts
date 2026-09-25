// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { migrationUiConfigSchema } from "./1781768391060_add-config-ui-table";
import { z } from "zod";
import { deepMergeZodObjects } from "../../../../../tools/validation";

const strictObject = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();
export const additionObject = strictObject({
    header: strictObject({
        menu: strictObject({
            devOrganizations: strictObject({ enabled: z.boolean() })
        })
    })
});

export const migrationUiConfigSchema2 = deepMergeZodObjects(migrationUiConfigSchema, additionObject);

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("author_organizations")
        .addColumn("id", "text", col => col.primaryKey())
        .addColumn("organization", "jsonb", col => col.notNull())
        .execute();

    const rawConfig = await db.selectFrom("config_ui").select("config").where("id", "=", "true").executeTakeFirst();

    const oldConfig = migrationUiConfigSchema.parse(rawConfig?.config);
    if (oldConfig) {
        let newConfig: any = oldConfig;
        newConfig.header.menu = {
            ...oldConfig.header.menu,
            devOrganizations: {
                enabled: false
            }
        };
        const validNew = migrationUiConfigSchema2.parse(newConfig);

        await db
            .updateTable("config_ui")
            .set({ config: validNew, updatedAt: new Date() })
            .where("id", "=", "true")
            .executeTakeFirst();
    }
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("author_organizations").execute();

    const rawConfig = await db.selectFrom("config_ui").select("config").where("id", "=", "true").executeTakeFirst();

    const oldConfig = migrationUiConfigSchema2.parse(rawConfig?.config);
    if (oldConfig) {
        let newConfig: any = oldConfig;
        delete newConfig.header.menu.devOrganizations;
        const validNew = migrationUiConfigSchema.parse(newConfig);
        await db
            .updateTable("config_ui")
            .set({ config: validNew, updatedAt: new Date() })
            .where("id", "=", "true")
            .executeTakeFirst();
    }
}
