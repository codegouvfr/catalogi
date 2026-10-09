import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Ghost CNLL rows keyed by annuaire id are never fetched (#520). Legit
    // unfetched rows are rediscovered on next update.
    await db
        .deleteFrom("software_external_datas")
        .where("sourceSlug", "in", db.selectFrom("sources").select("slug").where("kind", "=", "CNLL"))
        .where("lastDataFetchAt", "is", null)
        .execute();
}

export async function down(): Promise<void> {}
