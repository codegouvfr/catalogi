// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("software_attribute_definitions")
        .addColumn("detailsSection", "text", col => col.notNull().defaultTo("summary"))
        .addColumn("detailsSubsection", "jsonb")
        .execute();

    await db.schema
        .alterTable("software_attribute_definitions")
        .addCheckConstraint(
            "software_attribute_definitions_details_section_check",
            sql`"detailsSection" IN ('summary', 'usages', 'deployment', 'similar-software', 'sources')
                AND ("detailsSection" = 'summary' OR "detailsSubsection" IS NOT NULL)`
        )
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("software_attribute_definitions")
        .dropConstraint("software_attribute_definitions_details_section_check")
        .execute();

    await db.schema
        .alterTable("software_attribute_definitions")
        .dropColumn("detailsSection")
        .dropColumn("detailsSubsection")
        .execute();
}
