// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { SoftwareRepository } from "../../../ports/DbApiV2";
import { Software } from "../../../usecases/readWriteSillData";
import { Database } from "./kysely.database";
import { stripNullOrUndefinedValues, jsonBuildObject } from "./kysely.utils";

const dateParser = (str: string | Date | undefined | null) => {
    if (str && typeof str === "string") {
        const date = new Date(str);
        return date.valueOf();
    }
    if (str && str instanceof Date) {
        return str.valueOf();
    }
};

export const createPgSoftwareRepository = (db: Kysely<Database>): SoftwareRepository => {
    const getBySoftwareId = makeGetSoftwareById(db);
    return {
        create: async ({ formData, agentId }) => {
            const {
                softwareName,
                softwareDescription,
                softwareLicense,
                softwareLogoUrl,
                softwareMinimalVersion,
                isPresentInSupportContract,
                isFromFrenchPublicService,
                doRespectRgaa,
                similarSoftwareExternalDataIds,
                softwareType,
                externalIdForSource,
                sourceSlug,
                comptoirDuLibreId,
                softwareKeywords,
                ...rest
            } = formData;

            assert<Equals<typeof rest, {}>>();

            const now = Date.now();

            return db.transaction().execute(async trx => {
                const { softwareId } = await trx
                    .insertInto("softwares")
                    .values({
                        name: softwareName,
                        description: softwareDescription,
                        license: softwareLicense,
                        logoUrl: softwareLogoUrl,
                        versionMin: softwareMinimalVersion,
                        referencedSinceTime: now,
                        updateTime: now,
                        dereferencing: undefined,
                        isStillInObservation: false,
                        doRespectRgaa: doRespectRgaa,
                        isFromFrenchPublicService: isFromFrenchPublicService,
                        isPresentInSupportContract: isPresentInSupportContract,
                        sourceSlug: sourceSlug,
                        externalIdForSource: externalIdForSource,
                        comptoirDuLibreId: comptoirDuLibreId,
                        softwareType: JSON.stringify(softwareType),
                        workshopUrls: JSON.stringify([]),
                        categories: JSON.stringify([]),
                        generalInfoMd: undefined,
                        addedByAgentId: agentId,
                        keywords: JSON.stringify(softwareKeywords)
                    })
                    .returning("id as softwareId")
                    .executeTakeFirstOrThrow();

                console.log(
                    `inserted software correctly, softwareId is : ${softwareId} (${softwareName}), about to insert similars : `,
                    similarSoftwareExternalDataIds
                );

                if (similarSoftwareExternalDataIds.length > 0 && sourceSlug) {
                    await trx
                        .insertInto("softwares__similar_software_external_datas")
                        .values(
                            similarSoftwareExternalDataIds.map(similarExternalId => ({
                                softwareId,
                                similarExternalId,
                                sourceSlug
                            }))
                        )
                        .execute();
                }

                console.log("all good");

                return softwareId;
            });
        },
        updateLastExtraDataFetchAt: async ({ softwareId }) => {
            await db
                .updateTable("softwares")
                .set(
                    "lastExtraDataFetchAt",
                    sql`now
              ()`
                )
                .where("id", "=", softwareId)
                .executeTakeFirstOrThrow();
        },
        update: async ({ formData, softwareSillId, agentId }) => {
            const {
                softwareName,
                softwareDescription,
                softwareLicense,
                softwareLogoUrl,
                softwareMinimalVersion,
                isPresentInSupportContract,
                isFromFrenchPublicService,
                doRespectRgaa,
                similarSoftwareExternalDataIds,
                softwareType,
                externalIdForSource,
                sourceSlug,
                comptoirDuLibreId,
                softwareKeywords,
                ...rest
            } = formData;

            assert<Equals<typeof rest, {}>>();

            const now = Date.now();
            await db
                .updateTable("softwares")
                .set({
                    name: softwareName,
                    description: softwareDescription,
                    license: softwareLicense,
                    logoUrl: softwareLogoUrl,
                    versionMin: softwareMinimalVersion || null,
                    updateTime: now,
                    isStillInObservation: false,
                    doRespectRgaa: doRespectRgaa,
                    isFromFrenchPublicService: isFromFrenchPublicService,
                    isPresentInSupportContract: isPresentInSupportContract,
                    sourceSlug,
                    externalIdForSource,
                    comptoirDuLibreId: comptoirDuLibreId,
                    softwareType: JSON.stringify(softwareType),
                    workshopUrls: JSON.stringify([]),
                    categories: JSON.stringify([]),
                    generalInfoMd: undefined,
                    addedByAgentId: agentId,
                    keywords: JSON.stringify(softwareKeywords)
                })
                .where("id", "=", softwareSillId)
                .execute();
        },
        getByName: async (softwareName: string): Promise<Software | undefined> =>
            makeGetSoftwareBuilder(db)
                .where("name", "=", softwareName)
                .executeTakeFirst()
                .then((result): Software | undefined => {
                    if (!result) return;
                    const {
                        serviceProviders,
                        updateTime,
                        addedTime,
                        softwareExternalData,
                        similarExternalSoftwares,
                        externalIdForSource,
                        ...software
                    } = result;
                    return stripNullOrUndefinedValues({
                        ...software,
                        externalId: externalIdForSource,
                        updateTime: new Date(+updateTime).getTime(),
                        addedTime: new Date(+addedTime).getTime(),
                        serviceProviders: serviceProviders ?? [],
                        similarSoftwares: similarExternalSoftwares,
                        userAndReferentCountByOrganization: {},
                        authors: (softwareExternalData?.developers ?? []).map(dev => ({
                            "@type": "Person",
                            name: dev.name,
                            url: dev.url,
                            affiliations: dev.affiliations
                        })),
                        logoUrl: software?.logoUrl ?? softwareExternalData?.logoUrl,
                        officialWebsiteUrl:
                            softwareExternalData?.websiteUrl ??
                            software.comptoirDuLibreSoftware?.external_resources.website,
                        codeRepositoryUrl:
                            softwareExternalData?.sourceUrl ??
                            software.comptoirDuLibreSoftware?.external_resources.repository,
                        documentationUrl: softwareExternalData?.documentationUrl,
                        comptoirDuLibreServiceProviderCount: software.comptoirDuLibreSoftware?.providers.length ?? 0,
                        keywords: software?.keywords ?? softwareExternalData?.keywords ?? [],
                        programmingLanguages: softwareExternalData?.programmingLanguages ?? [],
                        referencePublications: softwareExternalData?.referencePublications,
                        identifiers: softwareExternalData?.identifiers,
                        applicationCategories: software.categories.concat(
                            softwareExternalData?.applicationCategories ?? []
                        ),
                        categories: undefined // merged in applicationCategories, set to undefined to remove it
                    });
                }),
        getById: getBySoftwareId,
        getSoftwareIdByExternalIdAndSlug: async ({ externalId, sourceSlug }) => {
            const result = await db
                .selectFrom("softwares")
                .select("softwares.id")
                .where("sourceSlug", "=", sourceSlug)
                .where("externalIdForSource", "=", externalId)
                .executeTakeFirst();
            return result?.id;
        },
        getByIdWithLinkedSoftwaresExternalIds: async softwareId => {
            const software = await getBySoftwareId(softwareId);
            if (!software) return;

            const { similarSoftwaresExternalIds } = await db
                .selectFrom("softwares as s")
                .leftJoin("softwares__similar_software_external_datas as sim", "sim.softwareId", "s.id")
                .select([
                    qb =>
                        qb.fn
                            .jsonAgg(qb.ref("sim.similarExternalId"))
                            .filterWhere("sim.similarExternalId", "is not", null)
                            .$castTo<string[]>()
                            .as("similarSoftwaresExternalIds")
                ])
                .groupBy("s.id")
                .where("id", "=", softwareId)
                .executeTakeFirstOrThrow();

            return {
                software,
                similarSoftwaresExternalIds: similarSoftwaresExternalIds ?? []
            };
        },
        getAll: ({ onlyIfUpdatedMoreThan3HoursAgo } = {}): Promise<Software[]> => {
            let builder = makeGetSoftwareBuilder(db);

            builder = onlyIfUpdatedMoreThan3HoursAgo
                ? builder.where(eb =>
                      eb.or([
                          eb("lastExtraDataFetchAt", "is", null),
                          eb(
                              "lastExtraDataFetchAt",
                              "<",
                              sql<Date>`now
                  ()
                  - interval '3 hours'`
                          )
                      ])
                  )
                : builder;

            return builder.execute().then(async softwares => {
                const userAndReferentCountByOrganization = await getUserAndReferentCountByOrganizationBySoftwareId(db);

                return softwares.map(
                    ({
                        serviceProviders,
                        updateTime,
                        addedTime,
                        softwareExternalData,
                        similarExternalSoftwares,
                        externalIdForSource,
                        ...software
                    }): Software => {
                        return stripNullOrUndefinedValues({
                            ...software,
                            externalId: externalIdForSource,
                            updateTime: new Date(+updateTime).getTime(),
                            addedTime: new Date(+addedTime).getTime(),
                            serviceProviders: serviceProviders ?? [],
                            similarSoftwares: similarExternalSoftwares,
                            latestVersion: software.latestVersion ?? {
                                semVer: softwareExternalData?.softwareVersion ?? undefined,
                                publicationTime: dateParser(softwareExternalData.publicationTime)
                            },
                            logoUrl: software?.logoUrl ?? softwareExternalData?.logoUrl,
                            userAndReferentCountByOrganization:
                                userAndReferentCountByOrganization[software.softwareId] ?? {},
                            authors: (softwareExternalData?.developers ?? []).map(dev => ({
                                "@type": "Person",
                                name: dev.name,
                                url: dev.url,
                                affiliations: dev.affiliations
                            })),
                            officialWebsiteUrl:
                                softwareExternalData?.websiteUrl ??
                                software.comptoirDuLibreSoftware?.external_resources.website ??
                                undefined,
                            codeRepositoryUrl:
                                softwareExternalData?.sourceUrl ??
                                software.comptoirDuLibreSoftware?.external_resources.repository ??
                                undefined,
                            documentationUrl: softwareExternalData?.documentationUrl ?? undefined,
                            comptoirDuLibreServiceProviderCount:
                                software.comptoirDuLibreSoftware?.providers.length ?? 0,
                            applicationCategories: software.categories.concat(
                                softwareExternalData?.applicationCategories ?? []
                            ),
                            categories: undefined, // merged in applicationCategories, set to undefined to remove it
                            programmingLanguages: softwareExternalData?.programmingLanguages ?? [],
                            referencePublications: softwareExternalData?.referencePublications,
                            identifiers: softwareExternalData?.identifiers
                        });
                    }
                );
            });
        },
        getAllSillSoftwareExternalIds: async sourceSlug =>
            db
                .selectFrom("softwares")
                .select("externalIdForSource")
                .where("sourceSlug", "=", sourceSlug)
                .execute()
                .then(rows => rows.map(row => row.externalIdForSource!)),

        countAddedByAgent: async ({ agentId }) => {
            const { count } = await db
                .selectFrom("softwares")
                .select(qb => qb.fn.countAll<string>().as("count"))
                .where("addedByAgentId", "=", agentId)
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
        }
    };
};

const makeGetSoftwareBuilder = (db: Kysely<Database>) =>
    db
        .selectFrom("softwares as s")
        .leftJoin("software_external_datas as ext", join =>
            join.onRef("ext.externalId", "=", "s.externalIdForSource").onRef("ext.sourceSlug", "=", "s.sourceSlug")
        )
        .leftJoin("sources", "sources.slug", "s.sourceSlug")
        .leftJoin("compiled_softwares as cs", "cs.softwareId", "s.id")
        .leftJoin(
            "softwares__similar_software_external_datas",
            "softwares__similar_software_external_datas.softwareId",
            "s.id"
        )
        .leftJoin(
            "software_external_datas as similarExt",
            "softwares__similar_software_external_datas.similarExternalId",
            "similarExt.externalId"
        )
        .groupBy([
            "s.id",
            "sources.priority",
            "cs.softwareId",
            "cs.annuaireCnllServiceProviders",
            "cs.comptoirDuLibreSoftware",
            "cs.latestVersion",
            "cs.serviceProviders",
            "ext.externalId"
        ])
        .orderBy("s.id", "asc")
        .orderBy("sources.priority", "desc")
        .select([
            "s.id as softwareId",
            ({ fn, ref }) =>
                fn
                    .coalesce(
                        ref("s.logoUrl"),
                        ref("ext.logoUrl"),
                        sql<string>`${ref("cs.comptoirDuLibreSoftware")} ->> 'logoUrl'`
                    )
                    .as("logoUrl"),
            "s.name as softwareName",
            "s.description as softwareDescription",
            "cs.serviceProviders",
            "cs.latestVersion",
            "s.referencedSinceTime as addedTime",
            "s.updateTime",
            "s.lastExtraDataFetchAt",
            "s.dereferencing",
            "s.categories",
            ({ ref }) =>
                jsonBuildObject({
                    isPresentInSupportContract: ref("isPresentInSupportContract"),
                    isFromFrenchPublicServices: ref("isFromFrenchPublicService"),
                    doRespectRgaa: ref("doRespectRgaa")
                }).as("prerogatives"),
            "s.comptoirDuLibreId",
            "cs.comptoirDuLibreSoftware",
            "s.versionMin",
            "s.license",
            "annuaireCnllServiceProviders",
            "s.externalIdForSource",
            "s.sourceSlug",
            "s.softwareType",
            "s.keywords",
            ({ ref }) =>
                jsonBuildObject({
                    externalId: ref("ext.externalId"),
                    sourceSlug: ref("ext.sourceSlug"),
                    developers: ref("ext.developers"),
                    label: ref("ext.label"),
                    description: ref("ext.description"),
                    isLibreSoftware: ref("ext.isLibreSoftware"),
                    logoUrl: ref("ext.logoUrl"),
                    websiteUrl: ref("ext.websiteUrl"),
                    sourceUrl: ref("ext.sourceUrl"),
                    documentationUrl: ref("ext.documentationUrl"),
                    programmingLanguages: ref("ext.programmingLanguages"),
                    applicationCategories: ref("ext.applicationCategories"),
                    referencePublications: ref("ext.referencePublications"),
                    identifiers: ref("ext.identifiers"),
                    keywords: ref("ext.keywords"),
                    softwareVersion: ref("ext.softwareVersion"),
                    publicationTime: ref("ext.publicationTime")
                }).as("softwareExternalData"),
            sql<[]>`'[]'`.as("similarExternalSoftwares"),
            ({ ref, fn }) =>
                fn
                    .coalesce(
                        fn
                            .jsonAgg(
                                jsonBuildObject({
                                    isInSill: sql<false>`false`,
                                    externalId: ref("similarExt.externalId"),
                                    label: ref("similarExt.label"),
                                    description: ref("similarExt.description"),
                                    isLibreSoftware: ref("similarExt.isLibreSoftware"),
                                    sourceSlug: ref("similarExt.sourceSlug")
                                }).$castTo<Software.SimilarSoftware>()
                            )
                            .filterWhere("similarExt.externalId", "is not", null),
                        sql<[]>`'[]'`
                    )
                    .as("similarExternalSoftwares")
        ]);

type CountForOrganisationAndSoftwareId = {
    organization: string | null;
    softwareId: number;
    type: "user" | "referent";
    count: string;
};

type UserAndReferentCountByOrganizationBySoftwareId = Record<
    string,
    Record<string, { userCount: number; referentCount: number }>
>;

const defaultCount = {
    userCount: 0,
    referentCount: 0
};

const getUserAndReferentCountByOrganizationBySoftwareId = async (
    db: Kysely<Database>
): Promise<UserAndReferentCountByOrganizationBySoftwareId> => {
    const softwareUserCountBySoftwareId: CountForOrganisationAndSoftwareId[] = await db
        .selectFrom("software_users as u")
        .innerJoin("users as a", "a.id", "u.agentId")
        .select([
            "u.softwareId",
            "a.organization",
            ({ fn }) => fn.countAll<string>().as("count"),
            sql<"user">`'userCount'`.as("type")
        ])
        .groupBy(["a.organization", "u.softwareId"])
        .execute();

    const softwareReferentCountBySoftwareId: CountForOrganisationAndSoftwareId[] = await db
        .selectFrom("software_referents as r")
        .innerJoin("users as a", "a.id", "r.agentId")
        .select([
            "r.softwareId",
            "a.organization",
            ({ fn }) => fn.countAll<string>().as("count"),
            sql<"referent">`'referentCount'`.as("type")
        ])
        .groupBy(["a.organization", "r.softwareId"])
        .execute();

    return [...softwareReferentCountBySoftwareId, ...softwareUserCountBySoftwareId].reduce(
        (acc, { organization, softwareId, type, count }): UserAndReferentCountByOrganizationBySoftwareId => {
            const orga = organization ?? "NO_ORGANIZATION";
            return {
                ...acc,
                [softwareId]: {
                    ...(acc[softwareId] ?? {}),
                    [orga]: {
                        ...(acc[softwareId]?.[orga] ?? defaultCount),
                        [type]: +count
                    }
                }
            };
        },
        {} as UserAndReferentCountByOrganizationBySoftwareId
    );
};

const filterDuplicate = (array: any[]) => {
    return array.filter(function (item: any, pos: number) {
        return array.indexOf(item) == pos;
    });
};

const makeGetSoftwareById =
    (db: Kysely<Database>) =>
    async (softwareId: number): Promise<Software | undefined> =>
        makeGetSoftwareBuilder(db)
            .where("id", "=", softwareId)
            .executeTakeFirst()
            .then((result): Software | undefined => {
                if (!result) return;
                const {
                    serviceProviders,
                    updateTime,
                    addedTime,
                    softwareExternalData,
                    similarExternalSoftwares,
                    externalIdForSource,
                    ...software
                } = result;
                return stripNullOrUndefinedValues({
                    ...software,
                    externalId: externalIdForSource,
                    updateTime: new Date(+updateTime).getTime(),
                    addedTime: new Date(+addedTime).getTime(),
                    serviceProviders: serviceProviders ?? [],
                    similarSoftwares: similarExternalSoftwares,
                    userAndReferentCountByOrganization: {},
                    authors: (softwareExternalData?.developers ?? []).map(dev => ({
                        "@type": "Person",
                        name: dev.name,
                        url: dev.url,
                        affiliations: dev.affiliations
                    })),
                    logoUrl: software?.logoUrl ?? softwareExternalData?.logoUrl,
                    officialWebsiteUrl:
                        softwareExternalData?.websiteUrl ??
                        software.comptoirDuLibreSoftware?.external_resources.website,
                    codeRepositoryUrl:
                        softwareExternalData?.sourceUrl ??
                        software.comptoirDuLibreSoftware?.external_resources.repository,
                    documentationUrl: softwareExternalData?.documentationUrl,
                    comptoirDuLibreServiceProviderCount: software.comptoirDuLibreSoftware?.providers.length ?? 0,
                    programmingLanguages: softwareExternalData?.programmingLanguages ?? [],
                    referencePublications: softwareExternalData?.referencePublications,
                    identifiers: softwareExternalData?.identifiers,
                    applicationCategories: filterDuplicate(
                        software.categories.concat(softwareExternalData?.applicationCategories ?? [])
                    ),
                    categories: undefined // merged in applicationCategories, set to undefined to remove it
                });
            });
