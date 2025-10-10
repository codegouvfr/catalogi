// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { SoftwareRepository } from "../../../ports/DbApiV2";
import { Database } from "./kysely.database";
import { stripNullOrUndefinedValues } from "./kysely.utils";

export const createPgSoftwareRepository = (db: Kysely<Database>): SoftwareRepository => {
    return {
        getAllO: async () => {
            const rows = await db.selectFrom("softwares").selectAll().execute();
            return rows.map(row => stripNullOrUndefinedValues(row));
        },
        getBySoftwareId: async (softwareId: number) => {
            const row = await db.selectFrom("softwares").selectAll().where("id", "=", softwareId).executeTakeFirst();
            if (!row) return;
            return stripNullOrUndefinedValues(row);
        },
        getByName: async ({ softwareName }) => {
            const row = await db
                .selectFrom("softwares")
                .selectAll()
                .where("name", "=", softwareName)
                .executeTakeFirst();
            return row ? stripNullOrUndefinedValues(row) : row;
        },
        create: async ({ software }) => {
            const {
                name,
                description,
                license,
                logoUrl,
                versionMin,
                referencedSinceTime,
                isStillInObservation,
                dereferencing,
                customAttributes,
                softwareType,
                workshopUrls,
                categories,
                generalInfoMd,
                keywords,
                addedByUserId,
                ...rest
            } = software;

            assert<Equals<typeof rest, {}>>();

            const now = new Date();

            return db.transaction().execute(async trx => {
                const { softwareId } = await trx
                    .insertInto("softwares")
                    .values({
                        name,
                        description,
                        license,
                        logoUrl,
                        versionMin,
                        referencedSinceTime,
                        updateTime: now,
                        dereferencing: JSON.stringify(dereferencing),
                        isStillInObservation, // Legacy field from SILL imported
                        customAttributes: JSON.stringify(customAttributes),
                        softwareType: JSON.stringify(softwareType),
                        workshopUrls: JSON.stringify(workshopUrls), // Legacy field from SILL imported
                        categories: JSON.stringify(categories), // Legacy field from SILL imported
                        generalInfoMd, // Legacy field from SILL imported
                        addedByUserId,
                        keywords: JSON.stringify(keywords)
                    })
                    .returning("id as softwareId")
                    .executeTakeFirstOrThrow();

                return softwareId;
            });
        },
        update: async ({ software, softwareId }) => {
            const {
                name,
                description,
                license,
                logoUrl,
                versionMin,
                dereferencing,
                isStillInObservation,
                customAttributes,
                softwareType,
                workshopUrls,
                categories,
                generalInfoMd,
                keywords,
                addedByUserId,
                ...rest
            } = software;

            assert<Equals<typeof rest, {}>>();

            const now = new Date();
            await db
                .updateTable("softwares")
                .set({
                    name,
                    description,
                    license,
                    logoUrl: logoUrl ?? null,
                    versionMin,
                    dereferencing: JSON.stringify(dereferencing),
                    updateTime: now,
                    isStillInObservation: false,
                    customAttributes: JSON.stringify(customAttributes),
                    softwareType: JSON.stringify(softwareType),
                    workshopUrls: JSON.stringify(workshopUrls),
                    categories: JSON.stringify(categories),
                    generalInfoMd: generalInfoMd,
                    addedByUserId,
                    keywords: JSON.stringify(keywords)
                })
                .where("id", "=", softwareId)
                .execute();
        },
        getSoftwareIdByExternalIdAndSlug: async ({ externalId, sourceSlug }) => {
            const result = await db
                .selectFrom("software_external_datas")
                .select("softwareId")
                .where("sourceSlug", "=", sourceSlug)
                .where("externalId", "=", externalId)
                .executeTakeFirst();
            return result?.softwareId ?? undefined;
        },
        getAllSillSoftwareExternalIds: async sourceSlug =>
            db
                .selectFrom("software_external_datas")
                .select("externalId")
                .where("sourceSlug", "=", sourceSlug)
                .execute()
                .then(rows => rows.map(row => row.externalId!)),

        countAddedByUser: async ({ userId }) => {
            const { count } = await db
                .selectFrom("softwares")
                .select(qb => qb.fn.countAll<string>().as("count"))
                .where("addedByUserId", "=", userId)
                .executeTakeFirstOrThrow();
            return +count;
        },
        unreference: async ({ softwareId, reason, time }) => {
            const { versionMin } = await db
                .selectFrom("softwares")
                .select("versionMin")
                .where("id", "=", softwareId)
                .executeTakeFirstOrThrow();

            await db
                .updateTable("softwares")
                .set({
                    dereferencing: JSON.stringify({
                        reason,
                        time,
                        lastRecommendedVersion: versionMin
                    })
                })
                .where("id", "=", softwareId)
                .executeTakeFirstOrThrow();
        },
        saveSimilarSoftwares: async params => {
            const dataToInsert = params.flatMap(({ softwareId, externalIds }) => {
                return externalIds.map(({ externalId, sourceSlug }) => ({
                    similarExternalId: externalId,
                    sourceSlug,
                    softwareId
                }));
            });

            if (dataToInsert.length > 0) {
                await db
                    .insertInto("software_external_datas")
                    .values(
                        dataToInsert.map(({ similarExternalId, sourceSlug }) => ({
                            externalId: similarExternalId,
                            sourceSlug,
                            label: JSON.stringify(""),
                            description: JSON.stringify(""),
                            developers: JSON.stringify([])
                        }))
                    )
                    .onConflict(oc => oc.doNothing())
                    .execute();
            }

            await db.transaction().execute(async trx => {
                await trx
                    .deleteFrom("softwares__similar_software_external_datas")
                    .where(
                        "softwareId",
                        "in",
                        params.map(({ softwareId }) => softwareId)
                    )
                    .execute();

                if (dataToInsert.length > 0) {
                    await trx
                        .insertInto("softwares__similar_software_external_datas")
                        .values(dataToInsert)
                        .onConflict(oc => oc.columns(["softwareId", "sourceSlug", "similarExternalId"]).doNothing())
                        .execute();
                }
            });
        },
        getSimilarSoftwareExternalDataPks: async ({ softwareId }) => {
            const similarIds = await db
                .selectFrom("softwares__similar_software_external_datas as similar")
                .innerJoin("software_external_datas as ext", "ext.externalId", "similar.similarExternalId")
                .select(["ext.softwareId", "ext.externalId", "ext.sourceSlug"])
                .where("similar.softwareId", "=", softwareId)
                .execute();

            return similarIds.map(({ externalId, sourceSlug, softwareId }) => ({
                externalId,
                sourceSlug,
                softwareId: softwareId ?? undefined
            }));
        },
        getUserAndReferentCountByOrganization: async ({ softwareId }) => {
            const softwareUserCount = await db
                .selectFrom("software_users")
                .innerJoin("users", "users.id", "software_users.userId")
                .select([
                    "users.organization",
                    ({ fn }) => fn.countAll<string>().as("count"),
                    sql<"userCount">`'userCount'`.as("type")
                ])
                .groupBy(["users.organization"])
                .where("software_users.softwareId", "=", softwareId)
                .execute();

            const softwareReferentCount = await db
                .selectFrom("software_referents as r")
                .innerJoin("users as u", "u.id", "r.userId")
                .select([
                    "u.organization",
                    ({ fn }) => fn.countAll<string>().as("count"),
                    sql<"referentCount">`'referentCount'`.as("type")
                ])
                .groupBy(["u.organization"])
                .where("r.softwareId", "=", softwareId)
                .execute();

            return [...softwareUserCount, ...softwareReferentCount].reduce(
                (acc, { organization, type, count }) => {
                    const orga = organization ?? "NO_ORGANIZATION";

                    return {
                        ...acc,
                        [orga]: {
                            ...defaultCount,
                            ...acc[orga],
                            [type]: +count
                        }
                    };
                },
                {} as Record<
                    string,
                    {
                        userCount: number;
                        referentCount: number;
                    }
                >
            );
        }
    };
};

export type UserAndReferentCountByOrganizationBySoftwareId = Record<
    string,
    Record<string, { userCount: number; referentCount: number }>
>;

const defaultCount = {
    userCount: 0,
    referentCount: 0
};
