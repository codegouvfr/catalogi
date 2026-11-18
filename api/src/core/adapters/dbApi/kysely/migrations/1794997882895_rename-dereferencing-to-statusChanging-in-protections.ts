// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Get all rows where protections might have a "dereferencing" key
    const rows = await db.selectFrom("softwares").select(["protections", "id"]).execute();

    const updatePromises = rows.map(async row => {
        const { protections, id } = row;

        if (!protections || typeof protections !== "object") {
            return Promise.resolve();
        }

        const protectionsObj = protections as Record<string, unknown>;
        if ("dereferencing" in protectionsObj) {
            const newProtections = {
                ...protectionsObj,
                statusChanging: protectionsObj.dereferencing
            };

            delete (newProtections as Record<string, unknown>).dereferencing;

            return db.updateTable("softwares").set({ protections: newProtections }).where("id", "=", id).execute();
        }

        return Promise.resolve();
    });

    await Promise.all(updatePromises);
}

export async function down(db: Kysely<any>): Promise<void> {
    // Get all rows where protections has a "statusChanging" key
    const rows = await db.selectFrom("softwares").select(["protections", "id"]).execute();

    const updatePromises = rows.map(async row => {
        const { protections, id } = row;

        if (!protections || typeof protections !== "object") {
            return Promise.resolve();
        }

        const protectionsObj = protections as Record<string, unknown>;
        if ("statusChanging" in protectionsObj) {
            const newProtections = {
                ...protectionsObj,
                dereferencing: protectionsObj.statusChanging
            };

            // Remove the statusChanging key
            delete (newProtections as Record<string, unknown>).statusChanging;

            return db.updateTable("softwares").set({ protections: newProtections }).where("id", "=", id).execute();
        }

        return Promise.resolve();
    });

    await Promise.all(updatePromises);
}
