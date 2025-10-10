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
            .then(row => (row ? stripNullOrUndefinedValues(row) : undefined))
});
