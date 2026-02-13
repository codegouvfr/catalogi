// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DatabaseDataType, DbApiV2 } from "../ports/DbApiV2";
import { resolveAdapterFromSource } from "../adapters/resolveAdapter";
import { castToSoftwareExternalData } from "../adapters/dbApi/kysely/createPgSoftwareExternalDataRepository";

type ParamsOfrefreshExternalDataUseCase = {
    dbApi: DbApiV2;
    minuteSkipSince?: number;
    softwareIdsToRefresh?: number[];
};

const useCaseLogTitle = "[UC.refreshExternalData]";
const useCaseLogTimer = `${useCaseLogTitle} Finsihed fetching external data`;

export type FetchAndSaveExternalDataForAllSoftware = () => Promise<boolean>;
export type FetchAndSaveExternalDataForSoftware = (args: { softwareId: number }) => Promise<boolean>;

const deduplicateExternalDataIds = (
    ids: { externalId: string; sourceSlug: string }[]
): { externalId: string; sourceSlug: string }[] => {
    const idsBySlugAndExternalId: Record<string, { externalId: string; sourceSlug: string }> = {};
    for (const id of ids) {
        idsBySlugAndExternalId[`${id.sourceSlug}::${id.externalId}`] = id;
    }
    return Object.values(idsBySlugAndExternalId);
};

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
                ...(externalDataBinded ?? []).map(({ externalId, sourceSlug }) => ({ externalId, sourceSlug })),
                ...simularExternalDataIDs.map(({ externalId, sourceSlug }) => ({ externalId, sourceSlug }))
            ];
        })
    );

    return deduplicateExternalDataIds(idsBySoftware.flat());
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

    for (const source of sources) {
        const gateway = resolveAdapterFromSource(source);

        if (!gateway.discoverSoftwareLinks) continue;

        console.log(`${useCaseLogTitle} Discovering software links for source "${source.slug}"`);

        try {
            const links = await gateway.discoverSoftwareLinks();
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
                    softwareExternalData: castToSoftwareExternalData(existingExternalData)
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

export const makeRefreshExternalDataAll = (
    deps: ParamsOfrefreshExternalDataUseCase
): FetchAndSaveExternalDataForAllSoftware => {
    const { dbApi, minuteSkipSince = 0, softwareIdsToRefresh } = deps;

    return async () => {
        console.time(useCaseLogTimer);

        await discoverNewSoftwareLinks(dbApi);

        const externalDataToUpdate =
            softwareIdsToRefresh && softwareIdsToRefresh.length > 0
                ? await getExternalDataIdsForSoftwareIds(dbApi, softwareIdsToRefresh)
                : await dbApi.softwareExternalData.getIds({ minuteSkipSince });

        if (softwareIdsToRefresh && softwareIdsToRefresh.length > 0) {
            console.log(
                `${useCaseLogTitle} Scoped update to software IDs [${softwareIdsToRefresh.join(", ")}], found ${
                    externalDataToUpdate.length
                } external data rows to refresh`
            );
        }

        return refreshExternalDataByExternalIdAndSlug({ dbApi, ids: externalDataToUpdate });
    };
};

export const makeRefreshExternalDataForSoftware = (
    deps: ParamsOfrefreshExternalDataUseCase
): FetchAndSaveExternalDataForSoftware => {
    const { dbApi } = deps;

    return async ({ softwareId }: { softwareId: number }) => {
        console.time(useCaseLogTimer);

        const externalDataBinded = await dbApi.softwareExternalData.getBySoftwareId({ softwareId });

        const simularExternalDataIDs = await dbApi.software.getSimilarSoftwareExternalDataPks({ softwareId });

        if (!externalDataBinded || externalDataBinded.length === 0) {
            console.error(`${useCaseLogTitle} No external data found for this software`);
            return false;
        }

        const idsArray = externalDataBinded.map(externdalDataItem => ({
            externalId: externdalDataItem.externalId,
            sourceSlug: externdalDataItem.sourceSlug
        }));
        return refreshExternalDataByExternalIdAndSlug({ dbApi, ids: idsArray.concat(simularExternalDataIDs) });
    };
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

    console.log(`[UC.refreshExternalData] ${ids.length} software external data sheet to update`);

    for (const { sourceSlug, externalId } of ids) {
        console.time(`[UC.refreshExternalData] 💾 Update for ${externalId} on ${sourceSlug} : Done 💾`);
        console.log(`[UC.refreshExternalData] 🚀 Update for ${externalId} on ${sourceSlug} : Starting 🚀`);

        try {
            const source = sourceBySlug[sourceSlug];

            const actualExternalDataRow = await dbApi.softwareExternalData.get({ sourceSlug, externalId });

            const sourceGateway = resolveAdapterFromSource(source);
            const externalData = await sourceGateway.softwareExternalData.getById({
                externalId: externalId,
                source: source
            });

            if (externalData) {
                await dbApi.softwareExternalData.update({
                    sourceSlug: source.slug,
                    externalId: externalId,
                    lastDataFetchAt: new Date(),
                    softwareExternalData: externalData,
                    ...(actualExternalDataRow?.softwareId ? { softwareId: actualExternalDataRow.softwareId } : {})
                });
            }
            console.timeEnd(`[UC.refreshExternalData] 💾 Update for ${externalId} on ${sourceSlug} : Done 💾`);
        } catch {
            console.error(`[UC.refreshExternalData] 💥 Update for ${externalId} on ${sourceSlug} : Failed 💥`);
            console.timeEnd(`[UC.refreshExternalData] 💾 Update for ${externalId} on ${sourceSlug} : Done 💾`);
        }
    }
    console.timeEnd(useCaseLogTimer);
    return true;
};
