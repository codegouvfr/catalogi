// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { z } from "zod";
import { deepMergeZodObjects } from "../../../../../tools/validation";
import { migrationUiConfigSchema2 } from "./1787644095962_create-author-org";

const strictObject = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();
export const additionObject = strictObject({
    header: strictObject({
        menu: strictObject({
            documentation: strictObject({ enabled: z.boolean(), href: z.string() })
        })
    })
});

export const migrationUiConfigSchema3 = deepMergeZodObjects(migrationUiConfigSchema2, additionObject);

export async function up(db: Kysely<any>): Promise<void> {
    const rawConfig = await db.selectFrom("config_ui").select("config").where("id", "=", "true").executeTakeFirst();

    const oldConfig = migrationUiConfigSchema2.parse(rawConfig?.config);
    if (oldConfig) {
        let newConfig: any = oldConfig;
        newConfig.header.menu = {
            ...oldConfig.header.menu,
            documentation: {
                enabled: false,
                href: "external.doc.org"
            }
        };
        const validNew = migrationUiConfigSchema3.parse(newConfig);

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

    const oldConfig = migrationUiConfigSchema3.parse(rawConfig?.config);
    if (oldConfig) {
        let newConfig: any = oldConfig;
        delete newConfig.header.menu.documentation;
        const validNew = migrationUiConfigSchema2.parse(newConfig);
        await db
            .updateTable("config_ui")
            .set({ config: validNew, updatedAt: new Date() })
            .where("id", "=", "true")
            .executeTakeFirst();
    }
}
