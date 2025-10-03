// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { DatabaseDataType, DbApiV2 } from "../ports/DbApiV2";
import { resolveAdapterFromSource } from "../adapters/resolveAdapter";

type ParamsOfrefreshExternalDataUseCase = {
    dbApi: DbApiV2;
    minuteSkipSince?: number;
};

const useCaseLogTitle = "[UC.refreshExternalData]";
const useCaseLogTimer = `${useCaseLogTitle} Finsihed fetching external data`;

export type FetchAndSaveExternalDataForAllSoftware = () => Promise<boolean>;
export type FetchAndSaveExternalDataForSoftware = (args: { softwareId: number }) => Promise<boolean>;

export const makeRefreshExternalDataAll = (
    deps: ParamsOfrefreshExternalDataUseCase
): FetchAndSaveExternalDataForAllSoftware => {
    const { dbApi, minuteSkipSince = 0 } = deps;

    return async () => {
        console.time(useCaseLogTimer);
        const externalDataToUpdate = await dbApi.softwareExternalData.getIds({ minuteSkipSince });
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

    console.log(`[UC.refreshExternalData] ${ids.length} software to update`);

    for (const { sourceSlug, externalId } of ids) {
        console.time(`[UC.refreshExternalData] 💾 Update for ${externalId} on ${sourceSlug} : Done 💾`);
        console.log(`[UC.refreshExternalData] 🚀 Update for ${externalId} on ${sourceSlug} : Starting 🚀`);
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
    }
    console.timeEnd(useCaseLogTimer);
    return true;
};
