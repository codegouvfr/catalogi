// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { DatabaseDataType, PopulatedExternalData, SoftwareRepository } from "../../../ports/DbApiV2";
import { LocalizedString } from "../../../ports/GetSoftwareExternalData";
import { SoftwareInList, Software } from "../../../usecases/readWriteSillData";
import { Database, SchemaPerson, SchemaOrganization } from "./kysely.database";
import { stripNullOrUndefinedValues, transformNullToUndefined } from "./kysely.utils";
import { mergeExternalData } from "./mergeExternalData";

type CountRow = { softwareId: number; organization: string | null; countType: string; count: string };
type SimilarRow = { softwareId: number; linkedSoftwareName: string | null; label: LocalizedString };

const aggregateCounts = (
    countRows: CountRow[]
): Record<number, Record<string, { userCount: number; referentCount: number }>> =>
    countRows.reduce(
        (acc, row) => {
            const org = row.organization ?? "NO_ORGANIZATION";
            const softwareCounts = acc[row.softwareId] ?? {};
            const orgCounts = softwareCounts[org] ?? { userCount: 0, referentCount: 0 };
            return {
                ...acc,
                [row.softwareId]: { ...softwareCounts, [org]: { ...orgCounts, [row.countType]: parseInt(row.count) } }
            };
        },
        {} as Record<number, Record<string, { userCount: number; referentCount: number }>>
    );

const aggregateSimilars = (
    similarRows: SimilarRow[]
): Record<number, Array<{ softwareName: string | undefined; label: LocalizedString | undefined }>> =>
    similarRows.reduce(
        (acc, row) => ({
            ...acc,
            [row.softwareId]: [
                ...(acc[row.softwareId] ?? []),
                { softwareName: row.linkedSoftwareName ?? undefined, label: row.label }
            ]
        }),
        {} as Record<number, Array<{ softwareName: string | undefined; label: LocalizedString | undefined }>>
    );

export const createPgSoftwareRepository = (db: Kysely<Database>): SoftwareRepository => {
    return {
        getFullList: async (): Promise<SoftwareInList[]> => {
            const [softwareRows, userCountRows, referentCountRows, similarRows, externalRows] = await Promise.all([
                db
                    .selectFrom("softwares")
                    .selectAll()
                    .where("dereferencing", "is", null)
                    .orderBy("name", "asc")
                    .execute(),

                db
                    .selectFrom("software_users")
                    .innerJoin("users", "users.id", "software_users.userId")
                    .select([
                        "software_users.softwareId",
                        "users.organization",
                        sql<string>`'userCount'`.as("countType"),
                        ({ fn }) => fn.countAll<string>().as("count")
                    ])
                    .groupBy(["software_users.softwareId", "users.organization"])
                    .execute(),

                db
                    .selectFrom("software_referents")
                    .innerJoin("users", "users.id", "software_referents.userId")
                    .select([
                        "software_referents.softwareId",
                        "users.organization",
                        sql<string>`'referentCount'`.as("countType"),
                        ({ fn }) => fn.countAll<string>().as("count")
                    ])
                    .groupBy(["software_referents.softwareId", "users.organization"])
                    .execute(),

                db
                    .selectFrom("softwares__similar_software_external_datas as sim")
                    .innerJoin("software_external_datas as ext", join =>
                        join
                            .onRef("ext.externalId", "=", "sim.similarExternalId")
                            .onRef("ext.sourceSlug", "=", "sim.sourceSlug")
                    )
                    .leftJoin("softwares as s", "s.id", "ext.softwareId")
                    .select(["sim.softwareId", "s.name as linkedSoftwareName", "ext.label"])
                    .execute(),

                db
                    .selectFrom("software_external_datas as ext")
                    .selectAll("ext")
                    .innerJoin("sources as s", "s.slug", "ext.sourceSlug")
                    .select(["s.kind", "s.priority", "s.url", "s.slug"])
                    .where("ext.softwareId", "is not", null)
                    .orderBy("ext.softwareId", "asc")
                    .orderBy("s.priority", "desc")
                    .execute()
            ]);

            // Aggregate external data by softwareId
            const externalBySoftwareId = externalRows.reduce(
                (acc, row) => ({
                    ...acc,
                    [row.softwareId!]: [...(acc[row.softwareId!] ?? []), transformNullToUndefined(row)]
                }),
                {} as Record<number, PopulatedExternalData[]>
            );

            const externalDataRecord = Object.entries(externalBySoftwareId).reduce(
                (acc, [softwareId, items]) => {
                    const merged = mergeExternalData(items);
                    return merged ? { ...acc, [softwareId]: merged } : acc;
                },
                {} as Record<number, DatabaseDataType.SoftwareExternalDataRow>
            );

            // Aggregate counts
            const allCountRows: CountRow[] = [
                ...userCountRows.map(r => ({ ...r, countType: "userCount" })),
                ...referentCountRows.map(r => ({ ...r, countType: "referentCount" }))
            ];
            const countsMap = aggregateCounts(allCountRows);

            // Aggregate similar softwares
            const similarMap = aggregateSimilars(similarRows as SimilarRow[]);

            // Combine all data
            return softwareRows.map(software => {
                const extData = externalDataRecord[software.id];
                return {
                    id: software.id,
                    softwareName: software.name,
                    softwareDescription: software.description,
                    logoUrl: extData?.logoUrl ?? software.logoUrl ?? undefined,
                    latestVersion: extData
                        ? {
                              semVer: extData.softwareVersion ?? undefined,
                              publicationTime: extData.publicationTime?.getTime()
                          }
                        : undefined,
                    addedTime: software.referencedSinceTime.getTime(),
                    updateTime: software.updateTime.getTime(),
                    applicationCategories: [...(software.categories ?? []), ...(extData?.applicationCategories ?? [])],
                    keywords: software.keywords ?? [],
                    softwareType: software.softwareType,
                    customAttributes: software.customAttributes ?? undefined,
                    programmingLanguages: extData?.programmingLanguages ?? [],
                    authors: (extData?.developers ?? []).map(dev => ({ name: dev.name })),
                    userAndReferentCountByOrganization: countsMap[software.id] ?? {},
                    similarSoftwares: similarMap[software.id] ?? []
                };
            });
        },
        getDetails: async (softwareId: number): Promise<Software | undefined> => {
            // Execute queries for single software in parallel
            const [softwareRow, externalDataRows, userCounts, referentCounts, similarSoftwareRows] = await Promise.all([
                db.selectFrom("softwares").selectAll().where("id", "=", softwareId).executeTakeFirst(),

                db
                    .selectFrom("software_external_datas as ext")
                    .selectAll("ext")
                    .innerJoin("sources as s", "s.slug", "ext.sourceSlug")
                    .select(["s.kind", "s.priority", "s.url", "s.slug"])
                    .where("ext.softwareId", "=", softwareId)
                    .execute(),

                db
                    .selectFrom("software_users")
                    .innerJoin("users", "users.id", "software_users.userId")
                    .select(["users.organization", ({ fn }) => fn.countAll<string>().as("count")])
                    .where("software_users.softwareId", "=", softwareId)
                    .groupBy("users.organization")
                    .execute(),

                db
                    .selectFrom("software_referents")
                    .innerJoin("users", "users.id", "software_referents.userId")
                    .select(["users.organization", ({ fn }) => fn.countAll<string>().as("count")])
                    .where("software_referents.softwareId", "=", softwareId)
                    .groupBy("users.organization")
                    .execute(),

                db
                    .selectFrom("softwares__similar_software_external_datas as sim")
                    .innerJoin("software_external_datas as ext", join =>
                        join
                            .onRef("ext.externalId", "=", "sim.similarExternalId")
                            .onRef("ext.sourceSlug", "=", "sim.sourceSlug")
                    )
                    .leftJoin("softwares as linkedSoft", "linkedSoft.id", "ext.softwareId")
                    .select([
                        "ext.externalId",
                        "ext.sourceSlug",
                        "ext.softwareId as linkedSoftwareId",
                        "linkedSoft.name as linkedSoftwareName",
                        "linkedSoft.description as linkedSoftwareDescription",
                        "linkedSoft.dereferencing as linkedSoftwareDereferencing",
                        "ext.label",
                        "ext.description",
                        "ext.isLibreSoftware"
                    ])
                    .where("sim.softwareId", "=", softwareId)
                    .execute()
            ]);

            if (!softwareRow) return undefined;

            // Merge external data by priority
            const extData = mergeExternalData(externalDataRows.map(row => transformNullToUndefined(row)));

            // Aggregate user/referent counts
            const userAndReferentCountByOrganization = [
                ...userCounts.map(r => ({ ...r, countType: "userCount" as const })),
                ...referentCounts.map(r => ({ ...r, countType: "referentCount" as const }))
            ].reduce(
                (acc, row) => {
                    const org = row.organization ?? "NO_ORGANIZATION";
                    const existing = acc[org] ?? { userCount: 0, referentCount: 0 };
                    return { ...acc, [org]: { ...existing, [row.countType]: parseInt(row.count) } };
                },
                {} as Record<string, { userCount: number; referentCount: number }>
            );

            // Format similar softwares
            const similarSoftwares: Software.SimilarSoftware[] = similarSoftwareRows.map(row => {
                if (row.linkedSoftwareId && row.linkedSoftwareDereferencing === null) {
                    return {
                        registered: true,
                        softwareId: row.linkedSoftwareId,
                        softwareName: row.linkedSoftwareName!,
                        softwareDescription: row.linkedSoftwareDescription!,
                        externalId: row.externalId,
                        label: row.label,
                        description: row.description,
                        isLibreSoftware: row.isLibreSoftware ?? undefined,
                        sourceSlug: row.sourceSlug
                    };
                }
                return {
                    registered: false,
                    sourceSlug: row.sourceSlug,
                    externalId: row.externalId,
                    isLibreSoftware: row.isLibreSoftware ?? undefined,
                    label: row.label,
                    description: row.description
                };
            });

            return {
                softwareId: softwareRow.id,
                softwareName: softwareRow.name,
                softwareDescription: softwareRow.description,
                logoUrl: extData?.logoUrl ?? softwareRow.logoUrl ?? undefined,
                latestVersion: extData
                    ? {
                          semVer: extData.softwareVersion ?? undefined,
                          publicationTime: extData.publicationTime?.getTime()
                      }
                    : undefined,
                addedTime: softwareRow.referencedSinceTime.getTime(),
                updateTime: softwareRow.updateTime.getTime(),
                dereferencing: softwareRow.dereferencing ?? undefined,
                applicationCategories: [...(softwareRow.categories ?? []), ...(extData?.applicationCategories ?? [])],
                customAttributes: softwareRow.customAttributes ?? undefined,
                userAndReferentCountByOrganization,
                authors: (extData?.developers ?? []).map((dev): SchemaPerson | SchemaOrganization =>
                    dev["@type"] === "Person"
                        ? {
                              "@type": "Person",
                              name: dev.name,
                              url: dev.url,
                              identifiers: dev.identifiers,
                              affiliations: dev.affiliations
                          }
                        : {
                              "@type": "Organization",
                              name: dev.name,
                              url: dev.url,
                              identifiers: dev.identifiers,
                              parentOrganizations: dev.parentOrganizations
                          }
                ),
                officialWebsiteUrl: extData?.websiteUrl ?? undefined,
                codeRepositoryUrl: extData?.sourceUrl ?? undefined,
                documentationUrl: extData?.documentationUrl ?? undefined,
                license: extData?.license ?? softwareRow.license,
                externalId: extData?.externalId,
                sourceSlug: extData?.sourceSlug,
                softwareType: softwareRow.softwareType,
                similarSoftwares,
                keywords: softwareRow.keywords ?? [],
                programmingLanguages: extData?.programmingLanguages ?? [],
                serviceProviders: extData?.providers ?? [],
                referencePublications: extData?.referencePublications,
                identifiers: extData?.identifiers
            };
        },
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
                        referencedSinceTime,
                        updateTime: now,
                        dereferencing: JSON.stringify(dereferencing),
                        isStillInObservation,
                        customAttributes: JSON.stringify(customAttributes),
                        softwareType: JSON.stringify(softwareType),
                        workshopUrls: JSON.stringify(workshopUrls),
                        categories: JSON.stringify(categories),
                        generalInfoMd,
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
            const row = await db
                .selectFrom("softwares")
                .select("customAttributes")
                .where("id", "=", softwareId)
                .executeTakeFirstOrThrow();

            const versionMin = row.customAttributes?.versionMin;

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
            const dataToInsert = params.flatMap(({ softwareId, softwareExternalDataItems }) => {
                return softwareExternalDataItems.map(softwareExternalData => ({
                    ...softwareExternalData,
                    softwareId
                }));
            });

            if (dataToInsert.length > 0) {
                await db
                    .insertInto("software_external_datas")
                    .values(
                        dataToInsert.map(({ externalId, sourceSlug, label, description, isLibreSoftware }) => ({
                            externalId,
                            sourceSlug,
                            label: JSON.stringify(label),
                            description: JSON.stringify(description),
                            isLibreSoftware: isLibreSoftware ?? null,
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
                        .values(
                            dataToInsert.map(({ externalId, sourceSlug, softwareId }) => ({
                                softwareId,
                                similarExternalId: externalId,
                                sourceSlug
                            }))
                        )
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
