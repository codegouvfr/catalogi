import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("softwares").addColumn("status", "jsonb").addColumn("statusHistory", "jsonb").execute();

    const deprecriated = await db
        .selectFrom("softwares")
        .select(["dereferencing", "id", "updateTime", "addedByUserId"])
        .execute();

    const updatedData = deprecriated.map(row => {
        const { dereferencing, id, updateTime, addedByUserId } = row;

        const status = {
            name: dereferencing ? "archived" : "published",
            changed: {
                reason: dereferencing?.reason || undefined,
                time: dereferencing?.time ?? updateTime,
                lastRecommendedVersion: dereferencing?.lastRecommendedVersion || undefined,
                changedByUserId: dereferencing?.dereferencedByUserId ?? addedByUserId
            }
        };

        return db.updateTable("softwares").set({ status }).where("id", "=", id).execute();
    });

    await Promise.all(updatedData);

    await db.schema.alterTable("softwares").dropColumn("dereferencing").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("softwares").addColumn("dereferencing", "jsonb").execute();

    const status = await db.selectFrom("softwares").select(["status", "id"]).execute();

    const updatedData = status.map(row => {
        const { status, id } = row;

        if (["archived", "rejected"].includes(status.name)) {
            const dereferencing = {
                reason: status.changed.reason,
                time: status.changed.time,
                lastRecommendedVersion: status.changed.lastRecommendedVersion,
                dereferencedByUserId: status.changed.changedByUserId
            };

            return db.updateTable("softwares").set({ dereferencing }).where("id", "=", id).execute();
        }

        return Promise.resolve();
    });

    await Promise.all(updatedData);

    await db.schema.alterTable("softwares").dropColumn("status").dropColumn("statusHistory").execute();
}
