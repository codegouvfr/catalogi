// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { AttributeDefinitionRepository } from "../../../ports/DbApiV2";
import { Database } from "./kysely.database";
import { stripNullOrUndefinedValues } from "./kysely.utils";

export const createPgAttributeDefinitionRepository = (db: Kysely<Database>): AttributeDefinitionRepository => ({
    getAll: async () =>
        db
            .selectFrom("software_attribute_definitions")
            .selectAll()
            .orderBy("displayOrder", "asc")
            .execute()
            .then(rows => rows.map(row => stripNullOrUndefinedValues(row))),
    getByName: async (name: string) =>
        db
            .selectFrom("software_attribute_definitions")
            .selectAll()
            .where("name", "=", name)
            .executeTakeFirst()
            .then(row => (row ? stripNullOrUndefinedValues(row) : undefined)),
    add: async def => {
        await db
            .insertInto("software_attribute_definitions")
            .values({
                name: def.name,
                kind: def.kind,
                label: JSON.stringify(def.label),
                description: def.description ? JSON.stringify(def.description) : null,
                displayInForm: def.displayInForm,
                editableByAdminOnly: def.editableByAdminOnly,
                displayInDetails: def.displayInDetails,
                displayInCardIcon: def.displayInCardIcon ?? null,
                enableFiltering: def.enableFiltering,
                required: def.required,
                displayOrder: def.displayOrder,
                createdAt: def.createdAt,
                updatedAt: def.updatedAt
            })
            .execute();
    },
    update: async (name, patch) => {
        if (Object.keys(patch).length === 0) return;
        const set: Record<string, unknown> = { updatedAt: new Date() };
        if (patch.label !== undefined) set.label = JSON.stringify(patch.label);
        if (patch.description !== undefined)
            set.description = patch.description ? JSON.stringify(patch.description) : null;
        if (patch.displayInForm !== undefined) set.displayInForm = patch.displayInForm;
        if (patch.editableByAdminOnly !== undefined) set.editableByAdminOnly = patch.editableByAdminOnly;
        if (patch.displayInDetails !== undefined) set.displayInDetails = patch.displayInDetails;
        if (patch.displayInCardIcon !== undefined) set.displayInCardIcon = patch.displayInCardIcon ?? null;
        if (patch.enableFiltering !== undefined) set.enableFiltering = patch.enableFiltering;
        if (patch.required !== undefined) set.required = patch.required;
        if (patch.displayOrder !== undefined) set.displayOrder = patch.displayOrder;
        await db.updateTable("software_attribute_definitions").set(set).where("name", "=", name).execute();
    }
});
