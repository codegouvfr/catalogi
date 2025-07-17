// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ComptoirDuLibreApi } from "../ports/ComptoirDuLibreApi";
import { DbApiV2, OtherSoftwareExtraData } from "../ports/DbApiV2";
import type { GetCnllPrestatairesSill } from "../ports/GetCnllPrestatairesSill";
import { GetServiceProviders } from "../ports/GetServiceProviders";
import type { GetSoftwareExternalData, SoftwareExternalData } from "../ports/GetSoftwareExternalData";
import type { Software, Source } from "shared";
import { PgComptoirDuLibre } from "./dbApi/kysely/kysely.database";

type ExternalId = string;
type SoftwareExternalDataCacheBySoftwareId = Partial<Record<ExternalId, SoftwareExternalData | undefined>>;

type FetchOtherExternalDataDependencies = {
    getCnllPrestatairesSill: GetCnllPrestatairesSill;
    comptoirDuLibreApi: ComptoirDuLibreApi;
    getServiceProviders: GetServiceProviders;
    wikidataSource: Source | undefined;
};

type FetchAndSaveSoftwareExtraDataDependencies = FetchOtherExternalDataDependencies & {
    getSoftwareExternalData: GetSoftwareExternalData;
    dbApi: DbApiV2;
};

export const makeFetchAndSaveSoftwareExtraData = async ({
    getSoftwareExternalData,
    dbApi,
    ...otherExternalDataDeps
}: FetchAndSaveSoftwareExtraDataDependencies) => {
    const mainSource = await dbApi.source.getMainSource();
    const getOtherExternalData = makeGetOtherExternalData(otherExternalDataDeps);
    const getSoftwareExternalDataAndSaveIt = makeGetSoftwareExternalData({
        dbApi,
        getSoftwareExternalData,
        mainSource
    });

    return async (softwareId: number, softwareExternalDataCache: SoftwareExternalDataCacheBySoftwareId) => {
        const data = await dbApi.software.getByIdWithLinkedSoftwaresExternalIds(softwareId);
        if (!data) return;

        const { software, similarSoftwaresExternalIds } = data;
        console.log(`🚀${software.softwareName}`);

        if (software.externalId) {
            console.log(" • Soft: ", software.softwareName, " - Own wiki : ", software.externalId);
            await getSoftwareExternalDataAndSaveIt(software.externalId, softwareExternalDataCache);
        }

        if (similarSoftwaresExternalIds.length > 0) {
            for (const similarExternalId of similarSoftwaresExternalIds) {
                console.log(" • Similar wiki : ", similarExternalId);
                await getSoftwareExternalDataAndSaveIt(similarExternalId, softwareExternalDataCache);
            }
        }

        const existingOtherSoftwareExtraData = await dbApi.otherSoftwareExtraData.getBySoftwareId(software.softwareId);
        const newOtherSoftwareExtraData = await getOtherExternalData(software, existingOtherSoftwareExtraData);

        if (newOtherSoftwareExtraData) await dbApi.otherSoftwareExtraData.save(newOtherSoftwareExtraData);
        await dbApi.software.updateLastExtraDataFetchAt({ softwareId: software.softwareId });
    };
};

const makeGetSoftwareExternalData =
    (deps: { getSoftwareExternalData: GetSoftwareExternalData; dbApi: DbApiV2; mainSource: Source }) =>
    async (externalId: ExternalId, cache: SoftwareExternalDataCacheBySoftwareId) => {
        if (cache[externalId]) return cache[externalId];

        const softwareExternalData = await deps.getSoftwareExternalData({ externalId, source: deps.mainSource });
        const softwareId = await deps.dbApi.software.getSoftwareIdByExternalIdAndSlug({
            externalId,
            sourceSlug: deps.mainSource.slug
        });

        if (softwareExternalData) {
            await deps.dbApi.softwareExternalData.save({ softwareExternalData, softwareId });
            cache[externalId] = softwareExternalData;
        }
    };

const makeGetOtherExternalData =
    (deps: FetchOtherExternalDataDependencies) =>
    async (
        software: Software,
        existingOtherSoftwareExtraData: OtherSoftwareExtraData | undefined
    ): Promise<OtherSoftwareExtraData | undefined> => {
        const [serviceProvidersBySoftwareId, cnllPrestatairesSill] = await Promise.all([
            deps.getServiceProviders(),
            deps.getCnllPrestatairesSill()
        ]);

        const comptoirDuLibreSoftware = await getNewComptoirDuLibre({
            comptoirDuLibreApi: deps.comptoirDuLibreApi,
            software,
            otherSoftwareExtraDataInCache: existingOtherSoftwareExtraData
        });

        const otherSoftwareExtraData: OtherSoftwareExtraData = {
            softwareId: software.softwareId,
            serviceProviders:
                deps.wikidataSource && software.sourceSlug === deps.wikidataSource.slug
                    ? (serviceProvidersBySoftwareId[software.softwareId.toString()] ?? [])
                    : [],
            comptoirDuLibreSoftware,
            annuaireCnllServiceProviders:
                deps.wikidataSource && software.sourceSlug === deps.wikidataSource.slug
                    ? (cnllPrestatairesSill
                          .find(({ sill_id }) => sill_id === software.softwareId)
                          ?.prestataires.map(({ nom, siren, url }) => ({
                              name: nom,
                              siren,
                              url
                          })) ?? null)
                    : null,
            latestVersion: null
        };

        if (
            otherSoftwareExtraData.serviceProviders.length === 0 &&
            otherSoftwareExtraData.comptoirDuLibreSoftware === null &&
            otherSoftwareExtraData.annuaireCnllServiceProviders === null &&
            otherSoftwareExtraData.latestVersion === null
        )
            return;

        return otherSoftwareExtraData;
    };

const getNewComptoirDuLibre = async ({
    software,
    comptoirDuLibreApi,
    otherSoftwareExtraDataInCache
}: {
    comptoirDuLibreApi: ComptoirDuLibreApi;
    software: Software;
    otherSoftwareExtraDataInCache: OtherSoftwareExtraData | undefined;
}): Promise<PgComptoirDuLibre.Software | null> => {
    if (software.comptoirDuLibreId === undefined) return null;
    const comptoirDuLibre = await comptoirDuLibreApi.getComptoirDuLibre();
    const comptoirDuLibreSoftware = comptoirDuLibre.softwares.find(
        comptoirDuLibreSoftware => comptoirDuLibreSoftware.id === software.comptoirDuLibreId
    );

    if (!comptoirDuLibreSoftware) return null;

    const alreadySavedCdlSoftware = otherSoftwareExtraDataInCache?.comptoirDuLibreSoftware;

    const [logoUrl, keywords] =
        alreadySavedCdlSoftware && alreadySavedCdlSoftware.id === comptoirDuLibreSoftware.id
            ? [alreadySavedCdlSoftware.logoUrl, alreadySavedCdlSoftware.keywords]
            : await Promise.all([
                  comptoirDuLibreApi.getIconUrl({ comptoirDuLibreId: comptoirDuLibreSoftware.id }),
                  comptoirDuLibreApi.getKeywords({ comptoirDuLibreId: comptoirDuLibreSoftware.id })
              ]);

    return { ...comptoirDuLibreSoftware, logoUrl, keywords };
};

export type FetchAndSaveExternalDataForAllSoftwares = Awaited<
    ReturnType<typeof makeFetchAndSaveExternalDataForAllSoftwares>
>;
export const makeFetchAndSaveExternalDataForAllSoftwares = async (deps: FetchAndSaveSoftwareExtraDataDependencies) => {
    const fetchOtherExternalData = await makeFetchAndSaveSoftwareExtraData(deps);
    return async () => {
        const softwares = await deps.dbApi.software.getAll({ onlyIfUpdatedMoreThan3HoursAgo: true });

        console.info(`About to update ${softwares.length} softwares`);

        const softwareExternalDataCache: SoftwareExternalDataCacheBySoftwareId = {};

        for (const software of softwares) {
            await fetchOtherExternalData(software.softwareId, softwareExternalDataCache);
        }
    };
};
