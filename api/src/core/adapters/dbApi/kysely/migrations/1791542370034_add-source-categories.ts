// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { sql, type Kysely } from "kysely";

// Frozen copy of `categoryByKind` at the time of this migration.
const categoryByKind: Record<string, string> = {
    UserInput: "UserInput",
    GitHub: "repository",
    GitLab: "repository",
    wikidata: "wikidata",
    HAL: "HAL",
    Zenodo: "Zenodo",
    ComptoirDuLibre: "ComptoirDuLibre",
    CNLL: "CNLL",
    ROR: "ROR",
    RNSR: "RNSR"
};

// Fallback order for categories that no existing source belongs to.
const defaultCategoryOrder = ["wikidata", "HAL", "Zenodo", "ComptoirDuLibre", "CNLL", "ROR", "RNSR"];

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
    // 1. Priority moves from sources to source categories. UserInput stays first (explicit
    // overrides), repository comes right after; the other categories keep their current
    // relative order, derived from the best-ranked source of each category.
    await db.schema
        .createTable("source_categories")
        .addColumn("category", "text", col => col.primaryKey())
        .addColumn("priority", "integer", col => col.notNull().unique())
        .execute();

    const sources: { kind: string; priority: number }[] = await db
        .selectFrom("sources")
        .select(["kind", "priority"])
        .execute();

    const bestPriorityByCategory = new Map<string, number>();
    for (const { kind, priority } of sources) {
        const category = categoryByKind[kind];
        if (category === undefined) throw new Error(`No source category for source kind "${kind}"`);
        const best = bestPriorityByCategory.get(category);
        if (best === undefined || priority < best) bestPriorityByCategory.set(category, priority);
    }

    const rank = (category: string) => bestPriorityByCategory.get(category) ?? Number.MAX_SAFE_INTEGER;
    const orderedCategories = [
        "UserInput",
        "repository",
        ...[...defaultCategoryOrder].sort((a, b) => rank(a) - rank(b))
    ];

    await db
        .insertInto("source_categories")
        .values(orderedCategories.map((category, priority) => ({ category, priority })))
        .execute();

    // 2. Each source belongs to a category, derived from its kind.
    await db.schema
        .alterTable("sources")
        .addColumn("category", "text", col =>
            col.references("source_categories.category").onUpdate("cascade").onDelete("restrict")
        )
        .execute();

    for (const [kind, category] of Object.entries(categoryByKind)) {
        await sql`UPDATE sources SET category = ${category} WHERE kind::text = ${kind}`.execute(db);
    }

    await db.schema
        .alterTable("sources")
        .alterColumn("category", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("sources").dropColumn("priority").execute();
    await db.schema
        .alterTable("sources")
        .addUniqueConstraint("sources_slug_category_key", ["slug", "category"])
        .execute();

    // 3. Denormalize the category on external data so the database can enforce
    // "at most one external data per (software, source category)". The composite FK
    // guarantees the copy always matches the source; the trigger fills it on writes so
    // callers keep inserting by `sourceSlug` only.
    await db.schema.alterTable("software_external_datas").addColumn("sourceCategory", "text").execute();
    await sql`
        UPDATE software_external_datas sed
        SET "sourceCategory" = s.category
        FROM sources s
        WHERE s.slug = sed."sourceSlug"
    `.execute(db);
    await db.schema
        .alterTable("software_external_datas")
        .alterColumn("sourceCategory", col => col.setNotNull())
        .execute();

    await sql`
        CREATE FUNCTION set_software_external_data_source_category() RETURNS trigger AS $$
        BEGIN
            SELECT category INTO NEW."sourceCategory" FROM sources WHERE slug = NEW."sourceSlug";
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    `.execute(db);
    await sql`
        CREATE TRIGGER software_external_datas_set_source_category
        BEFORE INSERT OR UPDATE OF "sourceSlug" ON software_external_datas
        FOR EACH ROW EXECUTE FUNCTION set_software_external_data_source_category()
    `.execute(db);

    await db.schema
        .alterTable("software_external_datas")
        .dropConstraint("software_external_datas_sourceSlug_fkey")
        .execute();
    await db.schema
        .alterTable("software_external_datas")
        .addForeignKeyConstraint(
            "software_external_datas_source_fkey",
            ["sourceSlug", "sourceCategory"],
            "sources",
            ["slug", "category"],
            constraint => constraint.onDelete("cascade").onUpdate("cascade")
        )
        .execute();

    // 4. The invariant itself. Fail with an actionable message rather than a bare unique
    // violation if the data already breaks it.
    const { rows: duplicates } = await sql<{ softwareId: number; sourceCategory: string; rows: string[] }>`
        SELECT "softwareId", "sourceCategory", array_agg("sourceSlug" || ':' || "externalId") AS rows
        FROM software_external_datas
        WHERE "softwareId" IS NOT NULL
        GROUP BY "softwareId", "sourceCategory"
        HAVING count(*) > 1
    `.execute(db);

    if (duplicates.length > 0) {
        const details = duplicates
            .map(
                ({ softwareId, sourceCategory, rows }) =>
                    `software #${softwareId} [${sourceCategory}]: ${rows.join(", ")}`
            )
            .join("\n");
        throw new Error(
            `Cannot enforce one external data per software and source category, resolve these duplicates first:\n${details}`
        );
    }

    await db.schema
        .createIndex("software_external_datas_one_per_source_category")
        .on("software_external_datas")
        .columns(["softwareId", "sourceCategory"])
        .unique()
        .where(sql.ref("softwareId"), "is not", null)
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropIndex("software_external_datas_one_per_source_category").execute();
    await db.schema
        .alterTable("software_external_datas")
        .dropConstraint("software_external_datas_source_fkey")
        .execute();
    await sql`DROP TRIGGER software_external_datas_set_source_category ON software_external_datas`.execute(db);
    await sql`DROP FUNCTION set_software_external_data_source_category()`.execute(db);
    await db.schema.alterTable("software_external_datas").dropColumn("sourceCategory").execute();

    await db.schema.alterTable("sources").dropConstraint("sources_slug_category_key").execute();
    await db.schema
        .alterTable("software_external_datas")
        .addForeignKeyConstraint(
            "software_external_datas_sourceSlug_fkey",
            ["sourceSlug"],
            "sources",
            ["slug"],
            constraint => constraint.onDelete("cascade")
        )
        .execute();

    // Sources sharing a category get consecutive priorities, ordered by slug.
    await db.schema.alterTable("sources").addColumn("priority", "integer").execute();
    await sql`
        UPDATE sources s
        SET priority = ranked.priority
        FROM (
            SELECT src.slug, (row_number() OVER (ORDER BY sc.priority, src.slug) - 1)::integer AS priority
            FROM sources src
            JOIN source_categories sc ON sc.category = src.category
        ) ranked
        WHERE ranked.slug = s.slug
    `.execute(db);
    await db.schema
        .alterTable("sources")
        .alterColumn("priority", col => col.setNotNull())
        .execute();
    await db.schema.alterTable("sources").addUniqueConstraint("sources_priority_key", ["priority"]).execute();

    await db.schema.alterTable("sources").dropColumn("category").execute();
    await db.schema.dropTable("source_categories").execute();
}
