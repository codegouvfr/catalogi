// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { DatabaseDataType, PopulatedExternalData, SoftwareRepository } from "../../../ports/DbApiV2";
import type { LocalizedString } from "../../../ports/GetSoftwareExternalData";
import { SoftwareInList, Software, SoftwareDetail, SoftwareSourceData } from "../../../usecases/readWriteSillData";
import type { Os, RuntimePlatform, SimilarSoftware } from "../../../types";
import { Database, USER_INPUT_SOURCE_SLUG } from "./kysely.database";
import { stripNullOrUndefinedValues, transformNullToUndefined } from "./kysely.utils";
import { mergeExternalData } from "./mergeExternalData";

const toSoftwareSourceData = (row: PopulatedExternalData): SoftwareSourceData => {
    const { slug, lastDataFetchAt, latestVersion, authors, softwareId: _softwareId, ...rest } = row;
    return {
        ...rest,
        sourceSlug: slug,
        lastDataFetchAt: lastDataFetchAt?.toISOString(),
        latestVersion: latestVersion
            ? {
                  version: latestVersion.version ?? undefined,
                  releaseDate: latestVersion.releaseDate ?? undefined
              }
            : undefined,
        // Hide the empty-authors array that every source row carries by default.
        authors: authors && authors.length > 0 ? authors : undefined
    };
};

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

const isBlankText = (value: unknown) => typeof value === "string" && value.trim() === "";

const isBlankLocalizedString = (value: unknown) => {
    if (value === undefined || value === null) return true;
    if (isBlankText(value)) return true;
    if (typeof value !== "object" || Array.isArray(value)) return false;

    const values = Object.values(value as Record<string, unknown>);
    return values.length === 0 || values.every(item => item === undefined || item === null || isBlankText(item));
};

const resolveLocalizedString = (value: unknown, fallback: LocalizedString): LocalizedString =>
    isBlankLocalizedString(value) ? fallback : (value as LocalizedString);

const resolveText = (value: string | null | undefined, fallback: string | null | undefined): string | undefined =>
    value === undefined || value === null || isBlankText(value) ? (fallback ?? undefined) : value;

const resolveArray = <T>(value: T[] | null | undefined, fallback: T[] | null | undefined = []): T[] =>
    value && value.length > 0 ? value : (fallback ?? []);

const resolveOptionalArray = <T>(value: T[] | null | undefined): T[] | undefined =>
    value && value.length > 0 ? value : undefined;

type UserInputWriteValues = {
    softwareId: number;
    name: string;
    description: LocalizedString;
    license: string;
    image: string | null;
    isLibreSoftware: boolean | null;
    url: string | null;
    codeRepositoryUrl: string | null;
    softwareHelp: string | null;
    latestVersion: { version: string | null; releaseDate: string | null } | null;
    keywords: string[];
    programmingLanguages: string[] | null;
    applicationCategories: string[];
    operatingSystems: Partial<Record<Os, boolean>>;
    runtimePlatforms: RuntimePlatform[];
};

// `externalId` is part of the primary key and can't be NULL, so we use `softwareId::text`
// as a stable sentinel that's unique per software within the `user_input` source. Refresh/
// import jobs skip `kind='user_input'` so this sentinel never gets fed to an external gateway.
const toUserInputRowValues = (v: UserInputWriteValues) => ({
    externalId: v.softwareId.toString(),
    sourceSlug: USER_INPUT_SOURCE_SLUG,
    softwareId: v.softwareId,
    authors: JSON.stringify([]),
    name: JSON.stringify({ fr: v.name }),
    description: JSON.stringify(v.description),
    isLibreSoftware: v.isLibreSoftware,
    image: v.image,
    url: v.url,
    codeRepositoryUrl: v.codeRepositoryUrl,
    softwareHelp: v.softwareHelp,
    license: v.license,
    latestVersion: v.latestVersion ? JSON.stringify(v.latestVersion) : null,
    keywords: JSON.stringify(v.keywords),
    programmingLanguages: v.programmingLanguages ? JSON.stringify(v.programmingLanguages) : null,
    applicationCategories: JSON.stringify(v.applicationCategories),
    operatingSystems: JSON.stringify(v.operatingSystems),
    runtimePlatforms: JSON.stringify(v.runtimePlatforms),
    lastDataFetchAt: new Date()
});

const buildUserInputWriteValues = (
    softwareId: number,
    software: {
        name: string;
        description: LocalizedString;
        license: string;
        image?: string | null;
        isLibreSoftware?: boolean | null;
        url?: string | null;
        codeRepositoryUrl?: string | null;
        softwareHelp?: string | null;
        latestVersion?: { version?: string | null; releaseDate?: string | null } | null;
        keywords: string[];
        programmingLanguages?: string[] | null;
        applicationCategories: string[];
        operatingSystems: Partial<Record<Os, boolean>>;
        runtimePlatforms: RuntimePlatform[];
    }
): UserInputWriteValues => ({
    softwareId,
    name: software.name,
    description: software.description,
    license: software.license,
    image: software.image ?? null,
    isLibreSoftware: software.isLibreSoftware ?? null,
    url: software.url ?? null,
    codeRepositoryUrl: software.codeRepositoryUrl ?? null,
    softwareHelp: software.softwareHelp ?? null,
    latestVersion: software.latestVersion
        ? {
              version: software.latestVersion.version ?? null,
              releaseDate: software.latestVersion.releaseDate ?? null
          }
        : null,
    keywords: software.keywords,
    programmingLanguages: software.programmingLanguages ?? null,
    applicationCategories: software.applicationCategories,
    operatingSystems: software.operatingSystems,
    runtimePlatforms: software.runtimePlatforms
});

export const createPgSoftwareRepository = (
    db: Kysely<Database>,
    options: { userInputEnabled: boolean }
): SoftwareRepository => {
    const { userInputEnabled } = options;
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
                        .orderBy("s.priority", "asc")
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

            return softwareRows.map(software => {
                const extData = externalDataRecord[software.id];
                const resolvedLatestVersion = extData?.latestVersion ?? software.latestVersion;
                return {
                    id: software.id,
                    name: resolveLocalizedString(extData?.name, { fr: software.name } as LocalizedString),
                    description: resolveLocalizedString(extData?.description, software.description as LocalizedString),
                    image: resolveText(extData?.image, software.image),
                    latestVersion: resolvedLatestVersion
                        ? {
                              version: resolvedLatestVersion.version ?? undefined,
                              releaseDate:
                                  resolvedLatestVersion.releaseDate ??
                                  (extData?.dateCreated ? extData.dateCreated.toISOString().slice(0, 10) : undefined)
                          }
                        : undefined,
                    addedTime: software.addedTime,
                    updateTime: software.updateTime,
                    applicationCategories: resolveArray(extData?.applicationCategories, software.applicationCategories),
                    keywords: resolveArray(extData?.keywords, software.keywords),
                    operatingSystems: (extData?.operatingSystems ?? software.operatingSystems ?? {}) as Partial<
                        Record<Os, boolean>
                    >,
                    runtimePlatforms: resolveArray(extData?.runtimePlatforms, software.runtimePlatforms),
                    customAttributes: software.customAttributes ?? undefined,
                    programmingLanguages: resolveArray(extData?.programmingLanguages, software.programmingLanguages),
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
                        .orderBy("s.priority", "asc")
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
                const resolvedLatestVersion = extData?.latestVersion ?? softwareRow.latestVersion;
                const externalIdentitySource = externalBySoftwareId[softwareRow.id]?.find(
                    row => row.sourceSlug !== USER_INPUT_SOURCE_SLUG
                );

                return {
                    id: softwareRow.id,
                    name: resolveLocalizedString(extData?.name, { fr: softwareRow.name } as LocalizedString),
                    description: resolveLocalizedString(
                        extData?.description,
                        softwareRow.description as LocalizedString
                    ),
                    image: resolveText(extData?.image, softwareRow.image),
                    latestVersion: resolvedLatestVersion
                        ? {
                              version: resolvedLatestVersion.version ?? undefined,
                              releaseDate:
                                  resolvedLatestVersion.releaseDate ??
                                  (extData?.dateCreated ? extData.dateCreated.toISOString().slice(0, 10) : undefined)
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
                    applicationCategories: resolveArray(
                        extData?.applicationCategories,
                        softwareRow.applicationCategories
                    ),
                    customAttributes: softwareRow.customAttributes ?? undefined,
                    userAndReferentCountByOrganization: countsMap[softwareRow.id] ?? {},
                    authors: extData?.authors ?? [],
                    url: resolveText(extData?.url, softwareRow.url),
                    codeRepositoryUrl: resolveText(extData?.codeRepositoryUrl, softwareRow.codeRepositoryUrl),
                    softwareHelp: resolveText(extData?.softwareHelp, softwareRow.softwareHelp),
                    license: resolveText(extData?.license, softwareRow.license) ?? "",
                    externalId: externalIdentitySource?.externalId,
                    sourceSlug: externalIdentitySource?.sourceSlug,
                    operatingSystems: (extData?.operatingSystems ?? softwareRow.operatingSystems ?? {}) as Partial<
                        Record<Os, boolean>
                    >,
                    runtimePlatforms: resolveArray(extData?.runtimePlatforms, softwareRow.runtimePlatforms),
                    similarSoftwares: similarMap[softwareRow.id] ?? [],
                    keywords: resolveArray(extData?.keywords, softwareRow.keywords),
                    programmingLanguages: resolveArray(extData?.programmingLanguages, softwareRow.programmingLanguages),
                    providers: extData?.providers ?? [],
                    referencePublications: resolveOptionalArray(extData?.referencePublications),
                    identifiers: resolveOptionalArray(extData?.identifiers),
                    repoMetadata: extData?.repoMetadata
                };
            });
        },
        getDetails: async (softwareId: number): Promise<SoftwareDetail | undefined> => {
            const [softwareRow, externalDataRows, userCounts, referentCounts, similarSoftwareRows] = await Promise.all([
                // The `softwares` content columns are still written and read as a fallback for
                // any field the merged external data doesn't provide. They'll be dropped in a
                // follow-up release once the user_input source is the only writer.
                db.selectFrom("softwares").selectAll().where("id", "=", softwareId).executeTakeFirst(),

                db
                    .selectFrom("software_external_datas as ext")
                    .selectAll("ext")
                    .innerJoin("sources as s", "s.slug", "ext.sourceSlug")
                    .select(["s.kind", "s.priority", "s.url as sourceUrl", "s.slug"])
                    .where("ext.softwareId", "=", softwareId)
                    .orderBy("s.priority", "asc")
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

            // `externalDataRows` is already sorted by priority ASC via the query.
            const populatedExternalRows = externalDataRows.map(row => transformNullToUndefined(row));
            const extData = mergeExternalData(populatedExternalRows);
            const dataBySource: SoftwareSourceData[] = populatedExternalRows.map(toSoftwareSourceData);

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
            const resolvedLatestVersion = extData?.latestVersion ?? softwareRow.latestVersion;
            // Identity fields (externalId/sourceSlug) must come from a real external source —
            // the user_input row's sentinel externalId would otherwise leak into the response.
            const externalIdentitySource = populatedExternalRows.find(row => row.sourceSlug !== USER_INPUT_SOURCE_SLUG);

            return {
                id: softwareRow.id,
                name: resolveLocalizedString(extData?.name, { fr: softwareRow.name } as LocalizedString),
                description: resolveLocalizedString(extData?.description, softwareRow.description as LocalizedString),
                image: resolveText(extData?.image, softwareRow.image),
                latestVersion: resolvedLatestVersion
                    ? {
                          version: resolvedLatestVersion.version ?? undefined,
                          releaseDate:
                              resolvedLatestVersion.releaseDate ??
                              (extData?.dateCreated ? extData.dateCreated.toISOString().slice(0, 10) : undefined)
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
                applicationCategories: resolveArray(extData?.applicationCategories, softwareRow.applicationCategories),
                customAttributes: softwareRow.customAttributes ?? undefined,
                userAndReferentCountByOrganization,
                authors: extData?.authors ?? [],
                url: resolveText(extData?.url, softwareRow.url),
                codeRepositoryUrl: resolveText(extData?.codeRepositoryUrl, softwareRow.codeRepositoryUrl),
                softwareHelp: resolveText(extData?.softwareHelp, softwareRow.softwareHelp),
                license: resolveText(extData?.license, softwareRow.license) ?? "",
                externalId: externalIdentitySource?.externalId,
                sourceSlug: externalIdentitySource?.sourceSlug,
                operatingSystems: (extData?.operatingSystems ?? softwareRow.operatingSystems ?? {}) as Partial<
                    Record<Os, boolean>
                >,
                runtimePlatforms: resolveArray(extData?.runtimePlatforms, softwareRow.runtimePlatforms),
                similarSoftwares,
                keywords: resolveArray(extData?.keywords, softwareRow.keywords),
                programmingLanguages: resolveArray(extData?.programmingLanguages, softwareRow.programmingLanguages),
                providers: extData?.providers ?? [],
                referencePublications: resolveOptionalArray(extData?.referencePublications),
                identifiers: resolveOptionalArray(extData?.identifiers),
                repoMetadata: extData?.repoMetadata,
                dataBySource
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
                isLibreSoftware,
                url,
                codeRepositoryUrl,
                softwareHelp,
                latestVersion,
                programmingLanguages,
                ...rest
            } = software;

            assert<Equals<typeof rest, {}>>();

            const now = new Date().toISOString();

            return db.transaction().execute(async trx => {
                // Step A–E keep writing content to `softwares` columns so older deployments can
                // be redeployed on top of this data without losing form-entered content.
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
                        keywords: JSON.stringify(keywords),
                        isLibreSoftware: isLibreSoftware ?? null,
                        url: url ?? null,
                        codeRepositoryUrl: codeRepositoryUrl ?? null,
                        softwareHelp: softwareHelp ?? null,
                        latestVersion: latestVersion ? JSON.stringify(latestVersion) : null,
                        programmingLanguages: programmingLanguages ? JSON.stringify(programmingLanguages) : null
                    })
                    .returning("id as softwareId")
                    .executeTakeFirstOrThrow();

                if (userInputEnabled) {
                    await trx
                        .insertInto("software_external_datas")
                        .values(toUserInputRowValues(buildUserInputWriteValues(softwareId, software)))
                        .execute();
                }

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
                isLibreSoftware,
                url,
                codeRepositoryUrl,
                softwareHelp,
                latestVersion,
                programmingLanguages,
                ...rest
            } = software;

            assert<Equals<typeof rest, {}>>();

            const now = new Date().toISOString();
            await db.transaction().execute(async trx => {
                // Step A–E keep updating `softwares` columns for reversibility.
                await trx
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
                        keywords: JSON.stringify(keywords),
                        isLibreSoftware: isLibreSoftware ?? null,
                        url: url ?? null,
                        codeRepositoryUrl: codeRepositoryUrl ?? null,
                        softwareHelp: softwareHelp ?? null,
                        latestVersion: latestVersion ? JSON.stringify(latestVersion) : null,
                        programmingLanguages: programmingLanguages ? JSON.stringify(programmingLanguages) : null
                    })
                    .where("id", "=", softwareId)
                    .execute();

                if (userInputEnabled) {
                    const userInputValues = toUserInputRowValues(buildUserInputWriteValues(softwareId, software));
                    const {
                        externalId: _externalId,
                        sourceSlug: _sourceSlug,
                        softwareId: _softwareId,
                        ...updateSet
                    } = userInputValues;

                    await trx
                        .insertInto("software_external_datas")
                        .values(userInputValues)
                        .onConflict(oc => oc.columns(["externalId", "sourceSlug"]).doUpdateSet(updateSet))
                        .execute();
                }
            });
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
