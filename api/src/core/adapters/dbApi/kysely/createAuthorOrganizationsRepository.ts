// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { AuthorOrganizationsRepository } from "../../../ports/DbApiV2";
import { Database } from "./kysely.database";

export const createPgAuthorOrganisationsRepository = (db: Kysely<Database>): AuthorOrganizationsRepository => ({
    getAll: async (params?: { ids?: Array<string> }) => {
        let query = db.selectFrom("author_organizations").select("organization");

        if (params?.ids) {
            query = query.where("id", "in", params.ids);
        }

        const result = await query.execute();
        return result.map(row => row.organization);
    },
    get: async ({ id }) => {
        const result = await db
            .selectFrom("author_organizations")
            .select("organization")
            .where("id", "==", id)
            .executeTakeFirstOrThrow();
        return result.organization;
    },
    save: async ({ organization }) => {
        await db
            .insertInto("author_organizations")
            .values({ id: organization.name, organization: organization })
            .onConflict(oc =>
                oc.columns(["id"]).doUpdateSet({
                    organization: organization
                })
            )
            .execute();

        return;
    },
    checkIfSaved: async ({ ids }) => {
        const result = await db.selectFrom("author_organizations").select("id").execute();

        const flatResult = result.map(org => org.id);
        const output: Record<string, boolean> = {};
        ids.forEach(id => {
            output[id] = flatResult.includes(id);
        });
        return output;
    }
});
