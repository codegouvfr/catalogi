// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DatabaseDataType, DbApiV2 } from "../ports/DbApiV2";
import { filterSourceByFeature, resolveAdapterFromSource } from "../adapters/resolveAdapter";
import { USER_INPUT_SOURCE_SLUG } from "../adapters/dbApi/kysely/kysely.database";
import { repoUrlToIdentifer } from "../../tools/repoAnalyser";
import { mergeDepuplicateIdentifierArray } from "../../tools/identifiersTools";
import { Source } from "../../lib/ApiTypes";
import { SoftwareExternal } from "../types/SoftwareTypes";

type ParamsOfrefreshExternalDataUseCase = {
    dbApi: DbApiV2;
};

const useCaseLogTitle = "[UC.refreshExternalData]";
const useCaseLogTimer = (source: string, ids: number[]) =>
    `${useCaseLogTitle} ${source} ${ids.toString()} Finished fetching external data`;

export type FetchAndSaveExternalData = (params: {
    minuteSkipSince?: number;
    sourceSlugs?: string[];
    softwareIdsToRefresh?: number[];
    externalIdsToRefresh?: string[];
}) => Promise<boolean>;
export type FetchAndSaveExternalDataForSoftware = (args: { softwareId: number }) => Promise<boolean>;

// Tools
const sourceValidators = async (params: { dbApi: DbApiV2; sourceSlugs: string[] | undefined }): Promise<Source[]> => {
    const { dbApi, sourceSlugs } = params;
    if (Array.isArray(sourceSlugs)) {
        if (sourceSlugs.length === 0) throw RangeError("Source can't be empty");
        const sources = await Promise.all(
            sourceSlugs.map(async (slug: string) => {
                const res = await dbApi.source.getByName({ name: slug });
                if (res) return res;
                else {
                    console.error(`${slug} is not found - skipping this setting`);
                    return undefined;
                }
            })
        );

        return sources.filter(source => !!source) as Source[];
    }

    return [];
};

const deduplicateExternalDataIds = (
    ids: { externalId: string; sourceSlug: string }[]
): { externalId: string; sourceSlug: string }[] => {
    const idsBySlugAndExternalId: Record<string, { externalId: string; sourceSlug: string }> = {};
    for (const id of ids) {
        idsBySlugAndExternalId[`${id.sourceSlug}::${id.externalId}`] = id;
    }
    return Object.values(idsBySlugAndExternalId);
};

const discoverNewSoftwareLinks = async (dbApi: DbApiV2): Promise<void> => {
    const sources = await dbApi.source.getAll();
    const softwareByIdCache: Record<number, Awaited<ReturnType<typeof dbApi.software.getBySoftwareId>>> = {};
    const activeSoftwareIdByNameCache: Record<string, number | undefined> = {};

    const getSoftwareById = async (softwareId: number) => {
        if (Object.prototype.hasOwnProperty.call(softwareByIdCache, softwareId)) {
            return softwareByIdCache[softwareId];
        }
        const software = await dbApi.software.getBySoftwareId(softwareId);
        softwareByIdCache[softwareId] = software;
        return software;
    };

    const getActiveSoftwareIdByName = async (softwareName: string) => {
        const trimmedName = softwareName.trim();
        if (Object.prototype.hasOwnProperty.call(activeSoftwareIdByNameCache, trimmedName)) {
            return activeSoftwareIdByNameCache[trimmedName];
        }

        const softwareByName = await dbApi.software.getByName({ softwareName: trimmedName });
        const activeId = softwareByName && softwareByName.dereferencing === undefined ? softwareByName.id : undefined;

        activeSoftwareIdByNameCache[trimmedName] = activeId;
        return activeId;
    };

    const resolveDiscoveredSoftwareId = async (link: {
        softwareId: number;
        softwareName?: string;
    }): Promise<number> => {
        const discoveredSoftware = await getSoftwareById(link.softwareId);

        if (discoveredSoftware?.dereferencing === undefined) return link.softwareId;
        if (!link.softwareName) return link.softwareId;

        const activeSoftwareId = await getActiveSoftwareIdByName(link.softwareName);
        return activeSoftwareId ?? link.softwareId;
    };

    const filteredSources = filterSourceByFeature(sources, "softwareExtra");

    for (const source of filteredSources) {
        // UserInput is a pseudo-source with no gateway; nothing to discover.
        if (source.kind === USER_INPUT_SOURCE_SLUG) continue;

        const gateway = resolveAdapterFromSource(source, "softwareExtra");

        if (!gateway.softwareExtra?.getDiscoverSoftwareLinks) continue;

        console.log(`${useCaseLogTitle} Discovering software links for source "${source.slug}"`);

        try {
            const links = await gateway.softwareExtra.getDiscoverSoftwareLinks();
            if (links.length === 0) continue;

            const linksToInsert: { sourceSlug: string; externalId: string; softwareId: number }[] = [];
            let rebindCount = 0;

            for (const link of links) {
                const resolvedSoftwareId = await resolveDiscoveredSoftwareId(link);
                const existingExternalData = await dbApi.softwareExternalData.get({
                    sourceSlug: source.slug,
                    externalId: link.externalId
                });

                if (!existingExternalData) {
                    linksToInsert.push({
                        sourceSlug: source.slug,
                        externalId: link.externalId,
                        softwareId: resolvedSoftwareId
                    });
                    continue;
                }

                if (existingExternalData.softwareId === resolvedSoftwareId) continue;

                const shouldRebind =
                    existingExternalData.softwareId === undefined
                        ? true
                        : await (async () => {
                              const [currentlyLinkedSoftware, discoveredSoftware] = await Promise.all([
                                  getSoftwareById(existingExternalData.softwareId!),
                                  getSoftwareById(resolvedSoftwareId)
                              ]);

                              if (!currentlyLinkedSoftware || !discoveredSoftware) return false;

                              return (
                                  currentlyLinkedSoftware.dereferencing !== undefined &&
                                  discoveredSoftware.dereferencing === undefined
                              );
                          })();

                if (!shouldRebind) continue;

                await dbApi.softwareExternalData.update({
                    sourceSlug: source.slug,
                    externalId: link.externalId,
                    softwareId: resolvedSoftwareId,
                    lastDataFetchAt: existingExternalData.lastDataFetchAt,
                    softwareExternalData: existingExternalData
                });

                rebindCount++;
            }

            if (linksToInsert.length > 0) {
                await dbApi.softwareExternalData.saveMany(linksToInsert);
            }

            console.log(
                `${useCaseLogTitle} Discovered ${linksToInsert.length} links for source "${source.slug}"` +
                    (rebindCount > 0 ? ` and rebound ${rebindCount} stale links` : "")
            );
        } catch (error) {
            console.error(`${useCaseLogTitle} Failed to discover links for source "${source.slug}": ${error}`);
        }
    }
};

const refreshExternalDataByExternalIdAndSlug = async (args: {
    dbApi: DbApiV2;
    ids: { externalId: string; sourceSlug: string }[];
}): Promise<boolean> => {
    const { dbApi, ids } = args;

    const sources = await dbApi.source.getAll();

    const sourceBySlug = sources.reduce<Record<string, DatabaseDataType.SourceRow>>((acc, source) => {
        acc[source.slug] = source;
        return acc;
    }, {});

    console.log(useCaseLogTitle, `${ids.length} software external data sheet to update`);

    const updateExternalData = async (params: { sourceSlug: string; externalId: string }) => {
        const { sourceSlug, externalId } = params;

        console.time(`[UC.refreshExternalData] 💾 Update for ${externalId} on ${sourceSlug} : Done 💾`);
        console.log(`[UC.refreshExternalData] 🚀 Update for ${externalId} on ${sourceSlug} : Starting 🚀`);

        try {
            const source = sourceBySlug[sourceSlug];

            const sourceGateway = resolveAdapterFromSource(source);
            if (!sourceGateway?.softwareExtra?.getSoftwareExternal)
                throw new Error(`Not implemetend on type ${sourceGateway.sourceType}`);

            const externalData = await sourceGateway.softwareExtra.getSoftwareExternal({
                externalId: externalId,
                source: source
            });

            await saveExternalData({
                sources,
                externalData,
                externalId,
                sourceSlug,
                dbApi
            });

            console.timeEnd(`[UC.refreshExternalData] 💾 Update for ${externalId} on ${sourceSlug} : Done 💾`);
        } catch {
            console.error(`[UC.refreshExternalData] 💥 Update for ${externalId} on ${sourceSlug} : Failed 💥`);
            console.timeEnd(`[UC.refreshExternalData] 💾 Update for ${externalId} on ${sourceSlug} : Done 💾`);
        }
    };

    const result = ids.reduce(
        (acc, { externalId, sourceSlug }) => {
            const existing = acc.find(item => item.sourceSlug === sourceSlug);
            if (existing) {
                existing.externalIds.push(externalId);
            } else {
                acc.push({ sourceSlug, externalIds: [externalId] });
            }
            return acc;
        },
        [] as { sourceSlug: string; externalIds: string[] }[]
    );

    await Promise.all(
        result.map(async idsRow => {
            console.debug(
                `${useCaseLogTitle} ${idsRow.externalIds.length} software externalData to update from ${idsRow.sourceSlug}`
            );
            console.time(
                `${useCaseLogTitle} ${idsRow.externalIds.length} software externalData to update from ${idsRow.sourceSlug}`
            );
            for (const externalId of idsRow.externalIds) {
                await updateExternalData({ sourceSlug: idsRow.sourceSlug, externalId });
            }
            console.timeEnd(
                `${useCaseLogTitle} ${idsRow.externalIds.length} software externalData to update from ${idsRow.sourceSlug}`
            );
        })
    );

    return true;
};

export const saveExternalData = async (params: {
    externalData: SoftwareExternal | undefined;
    dbApi: DbApiV2;
    externalId: string;
    sourceSlug: string;
    sources: Source[];
}) => {
    try {
        const { externalData, dbApi, externalId, sourceSlug, sources } = params;

        const actualExternalDataRow = await dbApi.softwareExternalData.get({ sourceSlug, externalId });

        const repoIdentifier = externalData?.codeRepositoryUrl
            ? await repoUrlToIdentifer({ repoUrl: externalData?.codeRepositoryUrl, sources })
            : undefined;

        if (externalData) {
            await dbApi.softwareExternalData.update({
                sourceSlug,
                externalId: externalId,
                lastDataFetchAt: new Date(),
                softwareExternalData: {
                    ...externalData,
                    identifiers: mergeDepuplicateIdentifierArray(
                        externalData.identifiers,
                        repoIdentifier ? [repoIdentifier] : []
                    )
                },
                ...(actualExternalDataRow?.softwareId ? { softwareId: actualExternalDataRow.softwareId } : {})
            });
        }
    } catch (err) {
        console.error(err);
    }
};

// Case 1 : Update a specific software, accross all sources

const getExternalDataIdsForSoftwareIds = async (
    dbApi: DbApiV2,
    softwareIdsToRefresh: number[]
): Promise<{ externalId: string; sourceSlug: string }[]> => {
    const idsBySoftware = await Promise.all(
        softwareIdsToRefresh.map(async softwareId => {
            const [externalDataBinded, simularExternalDataIDs] = await Promise.all([
                dbApi.softwareExternalData.getBySoftwareId({ softwareId }),
                dbApi.software.getSimilarSoftwareExternalDataPks({ softwareId })
            ]);

            return [
                // Skip the UserInput pseudo-source — it has no gateway to refresh.
                ...(externalDataBinded ?? [])
                    .filter(row => row.sourceSlug !== USER_INPUT_SOURCE_SLUG)
                    .map(({ externalId, sourceSlug }) => ({ externalId, sourceSlug })),
                ...simularExternalDataIDs.map(({ externalId, sourceSlug }) => ({ externalId, sourceSlug }))
            ];
        })
    );

    return deduplicateExternalDataIds(idsBySoftware.flat());
};

export const makeRefreshExternalDataForSoftware = (
    deps: ParamsOfrefreshExternalDataUseCase
): FetchAndSaveExternalDataForSoftware => {
    const { dbApi } = deps;

    return async ({ softwareId }: { softwareId: number }) => {
        console.time(useCaseLogTimer("", [softwareId]));

        const externalDataBinded = await dbApi.softwareExternalData.getBySoftwareId({ softwareId });

        const simularExternalDataIDs = await dbApi.software.getSimilarSoftwareExternalDataPks({ softwareId });

        if (!externalDataBinded || externalDataBinded.length === 0) {
            console.error(`${useCaseLogTitle} No external data found for this software`);
            return false;
        }

        const idsArray = externalDataBinded
            // Skip the UserInput pseudo-source — it has no gateway to refresh.
            .filter(row => row.sourceSlug !== USER_INPUT_SOURCE_SLUG)
            .map(externdalDataItem => ({
                externalId: externdalDataItem.externalId,
                sourceSlug: externdalDataItem.sourceSlug
            }));
        const res = await refreshExternalDataByExternalIdAndSlug({
            dbApi,
            ids: idsArray.concat(simularExternalDataIDs)
        });
        console.timeEnd(useCaseLogTimer("", [softwareId]));
        return res;
    };
};

// Case 2 : Update speficic external id on on source
export const refreshSomeExternalDataOnSource = async (args: {
    dbApi: DbApiV2;
    sourceSlug: string;
    externalIdsToRefresh: string[];
}) => {
    const { dbApi, sourceSlug, externalIdsToRefresh } = args;

    if (externalIdsToRefresh.length === 0) {
        throw new Error(`You need to specify at least one externalId in externalIdsToRefresh`);
    }

    console.debug(useCaseLogTitle, `Updating ${externalIdsToRefresh.length} externalIds from the source ${sourceSlug}`);
    const source = await sourceValidators({ dbApi, sourceSlugs: [sourceSlug] });
    if (source.length == 1) {
        const idsToRefresh = externalIdsToRefresh.map(id => ({ externalId: id, sourceSlug }));
        return refreshExternalDataByExternalIdAndSlug({ dbApi, ids: idsToRefresh });
    }

    throw new Error(`The source you specified (${sourceSlug}) is not found, please check the slug`);
};

// Case 3 : Update a specific source
export const refreshAllExternalDataBySource = async (args: {
    dbApi: DbApiV2;
    sourceSlugs: string[];
    minuteSkipSince?: number;
}) => {
    const { dbApi, sourceSlugs, minuteSkipSince = 0 } = args;

    if (sourceSlugs?.length && sourceSlugs.length > 0) {
        const sources = await sourceValidators({ dbApi, sourceSlugs });
        const ids = await Promise.all(
            sources.map(source => {
                return dbApi.softwareExternalData.getIds({ minuteSkipSince, sourceSlug: source.slug });
            })
        );

        console.debug(useCaseLogTitle, `Updating the following sources : ${sourceSlugs.join(", ")}`);
        return refreshExternalDataByExternalIdAndSlug({ dbApi, ids: ids.flat() });
    }

    return false;
};

// Case 4 : Update all (attention no record)
export const refreshAllExternalData = async (args: { dbApi: DbApiV2; minuteSkipSince?: number }) => {
    const { dbApi, minuteSkipSince } = args;
    const sources = await dbApi.source.getAll();
    return refreshAllExternalDataBySource({ dbApi, sourceSlugs: sources.map(source => source.slug), minuteSkipSince });
};

// Unified args parser that redirect to the expected logic
export const makeRefreshExternalData = (deps: ParamsOfrefreshExternalDataUseCase): FetchAndSaveExternalData => {
    const { dbApi } = deps;

    return async (params: {
        minuteSkipSince?: number;
        sourceSlugs?: string[];
        softwareIdsToRefresh?: number[];
        externalIdsToRefresh?: string[];
    }) => {
        const { sourceSlugs, minuteSkipSince, softwareIdsToRefresh, externalIdsToRefresh } = params;

        await discoverNewSoftwareLinks(dbApi);

        if (!!softwareIdsToRefresh && !!softwareIdsToRefresh?.length && softwareIdsToRefresh.length > 0) {
            if (sourceSlugs || externalIdsToRefresh || minuteSkipSince) {
                console.warn(useCaseLogTitle, "When usirng softwareIdsToRefresh, other args won't be used");
            }
            const idsToRefresh = await getExternalDataIdsForSoftwareIds(dbApi, softwareIdsToRefresh);
            return refreshExternalDataByExternalIdAndSlug({ dbApi, ids: idsToRefresh });
        }

        if (
            !!externalIdsToRefresh &&
            !!externalIdsToRefresh?.length &&
            externalIdsToRefresh.length > 0 &&
            !!sourceSlugs &&
            !!sourceSlugs?.length &&
            sourceSlugs.length === 1
        ) {
            if (minuteSkipSince) {
                console.warn(
                    useCaseLogTitle,
                    "minuteSkipSince was set but won't be use when update specific externalId on a source"
                );
            }
            return refreshSomeExternalDataOnSource({ dbApi, sourceSlug: sourceSlugs[0], externalIdsToRefresh });
        }

        if (!!sourceSlugs && !!sourceSlugs?.length && sourceSlugs.length > 0) {
            if (!!externalIdsToRefresh && !!externalIdsToRefresh?.length && externalIdsToRefresh.length > 0) {
                console.warn(
                    useCaseLogTitle,
                    "You set externalIdsToRefresh but  with more than one source, won't be using this arg"
                );
            }
            return refreshAllExternalDataBySource({ dbApi, sourceSlugs, minuteSkipSince });
        }

        return refreshAllExternalData({ dbApi, minuteSkipSince });
    };
};
