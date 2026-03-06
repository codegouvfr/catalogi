// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { DatabaseDataType, PopulatedExternalData, SoftwareRepository } from "../../../ports/DbApiV2";
import type { LocalizedString } from "../../../ports/GetSoftwareExternalData";
import { SoftwareInList, Software } from "../../../usecases/readWriteSillData";
import type { Os, RuntimePlatform, SimilarSoftware } from "../../../types";
import { Database } from "./kysely.database";
import { stripNullOrUndefinedValues, transformNullToUndefined } from "./kysely.utils";
import { mergeExternalData } from "./mergeExternalData";

type CountRow = { softwareId: number; organization: string | null; countType: string; count: string };
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

type EnrichedSimilarRow = {
    softwareId: number;
    externalId: string;
    sourceSlug: string;
    linkedSoftwareId: number | null;
    linkedSoftwareDereferencing: unknown;
    name: LocalizedString;
    description: LocalizedString;
    isLibreSoftware: boolean | null;
};

const aggregateEnrichedSimilars = (rows: EnrichedSimilarRow[]): Record<number, SimilarSoftware[]> =>
    rows.reduce(
        (acc, row) => ({
            ...acc,
            [row.softwareId]: [
                ...(acc[row.softwareId] ?? []),
                {
                    externalId: row.externalId,
                    sourceSlug: row.sourceSlug,
                    name: row.name,
                    description: row.description,
                    isLibreSoftware: row.isLibreSoftware ?? undefined,
                    isInCatalogi: row.linkedSoftwareId !== null && row.linkedSoftwareDereferencing === null,
                    softwareId: row.linkedSoftwareId ?? undefined
                }
            ]
        }),
        {} as Record<number, SimilarSoftware[]>
    );

export const createPgSoftwareRepository = (db: Kysely<Database>): SoftwareRepository => {
    return {
        getFullList: async (): Promise<SoftwareInList[]> => {
            const [softwareRows, userCountRows, referentCountRows, enrichedSimilarRows, externalRows] =
                await Promise.all([
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
                        .leftJoin("softwares as linkedSoft", "linkedSoft.id", "ext.softwareId")
                        .select([
                            "sim.softwareId",
                            "ext.externalId",
                            "ext.sourceSlug",
                            "ext.softwareId as linkedSoftwareId",
                            "linkedSoft.dereferencing as linkedSoftwareDereferencing",
                            "ext.name",
                            "ext.description",
                            "ext.isLibreSoftware"
                        ])
                        .execute(),

                    db
                        .selectFrom("software_external_datas as ext")
                        .selectAll("ext")
                        .innerJoin("sources as s", "s.slug", "ext.sourceSlug")
                        .select(["s.kind", "s.priority", "s.url as sourceUrl", "s.slug"])
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
            const similarMap = aggregateEnrichedSimilars(enrichedSimilarRows as EnrichedSimilarRow[]);

            // Combine all data
            return softwareRows.map(software => {
                const extData = externalDataRecord[software.id];
                return {
                    id: software.id,
                    name: software.name,
                    description: software.description,
                    image: extData?.image ?? software.image ?? undefined,
                    latestVersion: extData?.latestVersion
                        ? {
                              version: extData.latestVersion.version ?? undefined,
                              releaseDate:
                                  extData.latestVersion.releaseDate ??
                                  (extData.dateCreated ? extData.dateCreated.toISOString().slice(0, 10) : undefined)
                          }
                        : undefined,
                    addedTime: software.addedTime,
                    updateTime: software.updateTime,
                    applicationCategories: [
                        ...(software.applicationCategories ?? []),
                        ...(extData?.applicationCategories ?? [])
                    ],
                    keywords: software.keywords ?? [],
                    operatingSystems: (software.operatingSystems ?? {}) as Partial<Record<Os, boolean>>,
                    runtimePlatforms: (software.runtimePlatforms ?? []) as RuntimePlatform[],
                    customAttributes: software.customAttributes ?? undefined,
                    programmingLanguages: extData?.programmingLanguages ?? [],
                    authors: extData?.authors ?? [],
                    userAndReferentCountByOrganization: countsMap[software.id] ?? {},
                    similarSoftwares: similarMap[software.id] ?? []
                };
            });
        },
        getPublicList: async (): Promise<Software[]> => {
            const [softwareRows, userCountRows, referentCountRows, enrichedSimilarRows, externalRows] =
                await Promise.all([
                    db.selectFrom("softwares").selectAll().orderBy("name", "asc").execute(),

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
                        .leftJoin("softwares as linkedSoft", "linkedSoft.id", "ext.softwareId")
                        .select([
                            "sim.softwareId",
                            "ext.externalId",
                            "ext.sourceSlug",
                            "ext.softwareId as linkedSoftwareId",
                            "linkedSoft.dereferencing as linkedSoftwareDereferencing",
                            "ext.name",
                            "ext.description",
                            "ext.isLibreSoftware"
                        ])
                        .execute(),

                    db
                        .selectFrom("software_external_datas as ext")
                        .selectAll("ext")
                        .innerJoin("sources as s", "s.slug", "ext.sourceSlug")
                        .select(["s.kind", "s.priority", "s.url as sourceUrl", "s.slug"])
                        .where("ext.softwareId", "is not", null)
                        .orderBy("ext.softwareId", "asc")
                        .orderBy("s.priority", "desc")
                        .execute()
                ]);

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

            const allCountRows: CountRow[] = [
                ...userCountRows.map(r => ({ ...r, countType: "userCount" })),
                ...referentCountRows.map(r => ({ ...r, countType: "referentCount" }))
            ];
            const countsMap = aggregateCounts(allCountRows);
            const similarMap = aggregateEnrichedSimilars(enrichedSimilarRows as EnrichedSimilarRow[]);

            return softwareRows.map(softwareRow => {
                const extData = externalDataRecord[softwareRow.id];
                const deref = softwareRow.dereferencing;
                return {
                    id: softwareRow.id,
                    name: softwareRow.name,
                    description: softwareRow.description,
                    image: extData?.image ?? softwareRow.image ?? undefined,
                    latestVersion: extData?.latestVersion
                        ? {
                              version: extData.latestVersion.version ?? undefined,
                              releaseDate:
                                  extData.latestVersion.releaseDate ??
                                  (extData.dateCreated ? extData.dateCreated.toISOString().slice(0, 10) : undefined)
                          }
                        : undefined,
                    addedTime: softwareRow.addedTime,
                    updateTime: softwareRow.updateTime,
                    dereferencing: deref
                        ? {
                              reason: deref.reason,
                              time: new Date(deref.time).toISOString(),
                              lastRecommendedVersion: deref.lastRecommendedVersion
                          }
                        : undefined,
                    applicationCategories: [
                        ...(softwareRow.applicationCategories ?? []),
                        ...(extData?.applicationCategories ?? [])
                    ],
                    customAttributes: softwareRow.customAttributes ?? undefined,
                    userAndReferentCountByOrganization: countsMap[softwareRow.id] ?? {},
                    authors: extData?.authors ?? [],
                    url: extData?.url ?? undefined,
                    codeRepositoryUrl: extData?.codeRepositoryUrl ?? undefined,
                    softwareHelp: extData?.softwareHelp ?? undefined,
                    license: extData?.license ?? softwareRow.license,
                    externalId: extData?.externalId,
                    sourceSlug: extData?.sourceSlug,
                    operatingSystems: (softwareRow.operatingSystems ?? {}) as Partial<Record<Os, boolean>>,
                    runtimePlatforms: (softwareRow.runtimePlatforms ?? []) as RuntimePlatform[],
                    similarSoftwares: similarMap[softwareRow.id] ?? [],
                    keywords: softwareRow.keywords ?? [],
                    programmingLanguages: extData?.programmingLanguages ?? [],
                    providers: extData?.providers ?? [],
                    referencePublications: extData?.referencePublications,
                    identifiers: extData?.identifiers,
                    repoMetadata: extData?.repoMetadata
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
                    .select(["s.kind", "s.priority", "s.url as sourceUrl", "s.slug"])
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
                        "ext.name",
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

            const similarSoftwares: SimilarSoftware[] = similarSoftwareRows.map(row => ({
                externalId: row.externalId,
                sourceSlug: row.sourceSlug,
                name: row.name,
                description: row.description,
                isLibreSoftware: row.isLibreSoftware ?? undefined,
                isInCatalogi: row.linkedSoftwareId !== null && row.linkedSoftwareDereferencing === null,
                softwareId: row.linkedSoftwareId ?? undefined
            }));

            const deref = softwareRow.dereferencing;

            return {
                id: softwareRow.id,
                name: softwareRow.name,
                description: softwareRow.description,
                image: extData?.image ?? softwareRow.image ?? undefined,
                latestVersion: extData?.latestVersion
                    ? {
                          version: extData.latestVersion.version ?? undefined,
                          releaseDate:
                              extData.latestVersion.releaseDate ??
                              (extData.dateCreated ? extData.dateCreated.toISOString().slice(0, 10) : undefined)
                      }
                    : undefined,
                addedTime: softwareRow.addedTime,
                updateTime: softwareRow.updateTime,
                dereferencing: deref
                    ? {
                          reason: deref.reason,
                          time: new Date(deref.time).toISOString(),
                          lastRecommendedVersion: deref.lastRecommendedVersion
                      }
                    : undefined,
                applicationCategories: [
                    ...(softwareRow.applicationCategories ?? []),
                    ...(extData?.applicationCategories ?? [])
                ],
                customAttributes: softwareRow.customAttributes ?? undefined,
                userAndReferentCountByOrganization,
                authors: extData?.authors ?? [],
                url: extData?.url ?? undefined,
                codeRepositoryUrl: extData?.codeRepositoryUrl ?? undefined,
                softwareHelp: extData?.softwareHelp ?? undefined,
                license: extData?.license ?? softwareRow.license,
                externalId: extData?.externalId,
                sourceSlug: extData?.sourceSlug,
                operatingSystems: (softwareRow.operatingSystems ?? {}) as Partial<Record<Os, boolean>>,
                runtimePlatforms: (softwareRow.runtimePlatforms ?? []) as RuntimePlatform[],
                similarSoftwares,
                keywords: softwareRow.keywords ?? [],
                programmingLanguages: extData?.programmingLanguages ?? [],
                providers: extData?.providers ?? [],
                referencePublications: extData?.referencePublications,
                identifiers: extData?.identifiers,
                repoMetadata: extData?.repoMetadata
            };
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
                image,
                addedTime,
                isStillInObservation,
                dereferencing,
                customAttributes,
                operatingSystems,
                runtimePlatforms,
                applicationCategories,
                keywords,
                addedByUserId,
                ...rest
            } = software;

            assert<Equals<typeof rest, {}>>();

            const now = new Date().toISOString();

            return db.transaction().execute(async trx => {
                const { softwareId } = await trx
                    .insertInto("softwares")
                    .values({
                        name,
                        description: JSON.stringify(description),
                        license,
                        image,
                        addedTime,
                        updateTime: now,
                        dereferencing: JSON.stringify(dereferencing),
                        isStillInObservation,
                        customAttributes: JSON.stringify(customAttributes),
                        operatingSystems: JSON.stringify(operatingSystems),
                        runtimePlatforms: JSON.stringify(runtimePlatforms),
                        applicationCategories: JSON.stringify(applicationCategories),
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
                image,
                dereferencing,
                isStillInObservation,
                customAttributes,
                operatingSystems,
                runtimePlatforms,
                applicationCategories,
                keywords,
                addedByUserId,
                ...rest
            } = software;

            assert<Equals<typeof rest, {}>>();

            const now = new Date().toISOString();
            await db
                .updateTable("softwares")
                .set({
                    name,
                    description: JSON.stringify(description),
                    license,
                    image: image ?? null,
                    dereferencing: JSON.stringify(dereferencing),
                    updateTime: now,
                    isStillInObservation: false,
                    customAttributes: JSON.stringify(customAttributes),
                    operatingSystems: JSON.stringify(operatingSystems),
                    runtimePlatforms: JSON.stringify(runtimePlatforms),
                    applicationCategories: JSON.stringify(applicationCategories),
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
                        dataToInsert.map(({ externalId, sourceSlug, name, description, isLibreSoftware }) => ({
                            externalId,
                            sourceSlug,
                            name: JSON.stringify(name),
                            description: JSON.stringify(description),
                            isLibreSoftware: isLibreSoftware ?? null,
                            authors: JSON.stringify([])
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
        }
    };
};

export type UserAndReferentCountByOrganizationBySoftwareId = Record<
    string,
    Record<string, { userCount: number; referentCount: number }>
>;
