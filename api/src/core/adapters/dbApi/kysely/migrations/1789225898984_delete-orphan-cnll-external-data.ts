import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // importFromInnerIdentifiers used to treat CNLL as a primary source: it
    // registered the annuaire id that Comptoir du Libre cites in its own
    // identifiers as CNLL's externalId. But CNLL's adapter is keyed by SILL
    // id, so that id can never resolve there and the row's lastDataFetchAt
    // stays NULL forever, showing up as a stuck, empty "CNLL" column
    // alongside the real, populated one (#520).
    await db
        .deleteFrom("software_external_datas")
        .where("sourceSlug", "=", "cnll")
        .where("lastDataFetchAt", "is", null)
        .execute();
}

export async function down(): Promise<void> {
    // Data cleanup only. The deleted rows were never valid (their externalId
    // could never resolve), so there is nothing meaningful to restore.
}
