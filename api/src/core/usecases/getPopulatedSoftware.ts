// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import merge from "deepmerge";
import { DatabaseDataType, DbApiV2 } from "../ports/DbApiV2";
import { mergeArrays, OmitFromExisting } from "../utils";
import { Software } from "./readWriteSillData";

export type MakeGetPopulatedSoftware = (dbApi: DbApiV2) => GetPopulatedSoftware;
export type GetPopulatedSoftware = () => Promise<Software[]>;

export type MakeGetPopulatedSoftwareItem = (dbApi: DbApiV2) => GetPopulatedSoftwareItem;
export type GetPopulatedSoftwareItem = (
    softwareItem: DatabaseDataType.SoftwareRow | number,
    full: boolean
) => Promise<Software>;

const dateParser = (str: string | Date | undefined | null) => {
    if (str && typeof str === "string") {
        const date = new Date(str);
        return date.valueOf();
    }
    if (str && str instanceof Date) {
        return str.valueOf();
    }
};

type MissingData = Pick<Software, "userAndReferentCountByOrganization" | "similarSoftwares">;

export const makeGetPopulatedSoftware: MakeGetPopulatedSoftware = (dbApi: DbApiV2) => async () => {
    const sofware = await dbApi.software.getAllO();
    const getPopulatedSoftware = makeGetPopulatedSoftwareItem(dbApi);

    const UIsofware = await Promise.all(sofware.map(async softwareItem => getPopulatedSoftware(softwareItem, true)));

    return UIsofware;
};

export const makeGetPopulatedSoftwareItem: MakeGetPopulatedSoftwareItem = (dbApi: DbApiV2) => {
    return async (softwareData: DatabaseDataType.SoftwareRow | number, isFull: boolean): Promise<Software> => {
        const softwareItem =
            typeof softwareData !== "number" ? softwareData : await dbApi.software.getBySoftwareId(softwareData);

        if (!softwareItem) throw new Error(`Could find a software`);

        const formatedSoftwareUI = formatSoftwareRowToUISoftware(softwareItem);

        const mergedExternalDataItem = await dbApi.softwareExternalData.getMergedBySoftwareId({
            softwareId: softwareItem.id
        });
        const missingData: MissingData = {
            userAndReferentCountByOrganization: {},
            similarSoftwares: []
        };

        if (isFull) {
            const similarSoftwareIds = await dbApi.software.getSimilarSoftwareExternalDataPks({
                softwareId: softwareItem.id
            });
            const similarSoftware = await Promise.all(
                similarSoftwareIds.map(async softwareData => {
                    if (softwareData.softwareId) {
                        const software = await dbApi.software.getBySoftwareId(softwareData.softwareId);

                        if (!software) return undefined;

                        return {
                            registered: software.dereferencing === undefined,
                            softwareId: software.id,
                            softwareName: software.name,
                            softwareDescription: software.description,
                            externalId: "", //TODO Remove,
                            label: software.name,
                            description: software.description,
                            isLibreSoftware: software.dereferencing === undefined,
                            sourceSlug: "" // TODO Remove
                        };
                    }

                    const externalData = await dbApi.softwareExternalData.get({
                        sourceSlug: softwareData.sourceSlug,
                        externalId: softwareData.externalId
                    });

                    if (externalData) {
                        return formatToSimularNotRegisteredSoftware(externalData);
                    }

                    throw new Error("Wrong database values");
                })
            );
            missingData.similarSoftwares = similarSoftware.filter(soft => !!soft);

            missingData.userAndReferentCountByOrganization = await dbApi.software.getUserAndReferentCountByOrganization(
                { softwareId: softwareItem.id }
            );
        }

        if (mergedExternalDataItem) {
            return merge.all<Software>(
                [missingData, formatExternalDataRowToUISoftware(mergedExternalDataItem), formatedSoftwareUI],
                { arrayMerge: mergeArrays }
            );
        }

        return merge.all<Software>(
            [
                {
                    serviceProviders: [],
                    latestVersion: {},
                    authors: [],
                    officialWebsiteUrl: undefined,
                    codeRepositoryUrl: undefined,
                    documentationUrl: undefined,
                    programmingLanguages: []
                },
                missingData,
                formatedSoftwareUI
            ],
            { arrayMerge: mergeArrays }
        );
    };
};

type DataFromSofwareRow = Pick<
    Software,
    | "softwareId"
    | "softwareDescription"
    | "softwareName"
    | "updateTime"
    | "addedTime"
    | "logoUrl"
    | "applicationCategories"
    | "license"
    | "keywords"
    | "softwareType"
    | "dereferencing"
    | "sourceSlug"
    | "externalId"
    | "customAttributes"
>;
const formatSoftwareRowToUISoftware = (
    software: DatabaseDataType.SoftwareRow
): OmitFromExisting<DataFromSofwareRow, "sourceSlug" | "externalId"> => {
    return {
        softwareId: software.id,
        softwareDescription: software.description,
        softwareName: software.name,
        updateTime: software.updateTime.getTime(),
        addedTime: software.referencedSinceTime.getTime(),
        logoUrl: software.logoUrl,
        applicationCategories: software.categories,
        license: software.license,
        keywords: software.keywords,
        softwareType: software.softwareType,
        customAttributes: software.customAttributes,
        dereferencing: software.dereferencing
    };
};

type DataFromExternalRow = Pick<
    Software,
    | "externalId"
    | "authors"
    | "officialWebsiteUrl"
    | "logoUrl"
    | "codeRepositoryUrl"
    | "documentationUrl"
    | "programmingLanguages"
    | "referencePublications"
    | "identifiers"
    | "license"
    | "applicationCategories"
    | "latestVersion"
    | "serviceProviders"
    | "sourceSlug"
>;
const formatExternalDataRowToUISoftware = (
    externalDataRow: DatabaseDataType.SoftwareExternalDataRow
): DataFromExternalRow => {
    return {
        externalId: externalDataRow.externalId,
        authors: (externalDataRow.developers ?? []).map(dev => ({
            "@type": "Person",
            name: dev.name,
            url: dev.url,
            identifiers: dev.identifiers,
            affiliations: dev["@type"] === "Person" ? dev.affiliations : []
        })),
        officialWebsiteUrl: externalDataRow.websiteUrl,
        logoUrl: externalDataRow.logoUrl,
        codeRepositoryUrl: externalDataRow.sourceUrl,
        documentationUrl: externalDataRow.documentationUrl,
        programmingLanguages: externalDataRow.programmingLanguages ?? [],
        referencePublications: externalDataRow.referencePublications,
        identifiers: externalDataRow.identifiers,
        license: externalDataRow.license ?? "",
        applicationCategories: externalDataRow.applicationCategories ?? [],
        latestVersion: {
            semVer: externalDataRow.softwareVersion,
            publicationTime: dateParser(externalDataRow.publicationTime)
        },
        serviceProviders: externalDataRow.providers ?? [],
        sourceSlug: externalDataRow.sourceSlug
    };
};

const formatToSimularNotRegisteredSoftware = (
    externalData: DatabaseDataType.SoftwareExternalDataRow
): Software.SimilarSoftware.SimilarSoftwareNotRegistered => {
    return {
        registered: false,
        sourceSlug: externalData.sourceSlug,
        externalId: externalData.externalId,
        isLibreSoftware: externalData.isLibreSoftware,
        label: externalData.label,
        description: externalData.description
    };
};
