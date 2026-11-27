// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import { SoftwareFormData, Source } from "../../usecases/readWriteSillData";
import { makeZenodoApi } from "./zenodoAPI";
import { Zenodo } from "./zenodoAPI/type";
import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { SoftwareExternal } from "../../types/SoftwareTypes";
import { createResolveLocalizedString } from "i18nifty/LocalizedString/reactless";
import type { Language } from "../../ports/GetSoftwareExternalData";

const { resolveLocalizedString } = createResolveLocalizedString<Language>({
    "currentLanguage": "fr",
    "fallbackLanguage": "en"
});

export const getZenodoSoftwareFormData: GetSoftwareFormData = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }) => {
        if (source.kind !== "Zenodo" && source.url !== "https://zenodo.org/")
            throw new Error(`Not a Zenodo source, was : ${source.kind}`);

        const zenodoApi = makeZenodoApi(source);
        const record = await zenodoApi.records.get(Number(externalId));

        if (!record || record.status == 410) return undefined;
        if (record.metadata.resource_type.type !== "software")
            throw new TypeError(`The record corresponding at ${externalId} is not a software`);

        return formatRecordToSoftwareFormData(record, source);
    }
);

export const formatExternalDataToFormData = (zenodoExternalData: SoftwareExternal): SoftwareFormData => {
    return {
        name: resolveLocalizedString(zenodoExternalData.name),
        nameOverride: null,
        description: resolveLocalizedString(zenodoExternalData.description) ?? null,
        operatingSystems: { "linux": false, "windows": false, "android": false, "ios": false, "mac": false },
        runtimePlatforms: [],
        externalIdForSource: zenodoExternalData.externalId,
        sourceSlug: zenodoExternalData.sourceSlug,
        license: zenodoExternalData.license ?? null,
        similarSoftwareExternalDataItems: [],
        image: null,
        keywords: zenodoExternalData.keywords ?? [],
        customAttributes: undefined,
        isLibreSoftware: null,
        url: zenodoExternalData.url ?? null,
        codeRepositoryUrl: zenodoExternalData.codeRepositoryUrl ?? null,
        softwareHelp: null,
        latestVersion: zenodoExternalData.latestVersion
            ? {
                  version: zenodoExternalData.latestVersion.version ?? null,
                  releaseDate: zenodoExternalData.latestVersion.releaseDate ?? null
              }
            : null
    };
};

export const formatRecordToSoftwareFormData = (recordSoftwareItem: Zenodo.Record, source: Source): SoftwareFormData => {
    const publicationIso = recordSoftwareItem.metadata.publication_date
        ? new Date(recordSoftwareItem.metadata.publication_date).toISOString()
        : undefined;

    return {
        name: recordSoftwareItem.title,
        nameOverride: null,
        description: recordSoftwareItem.metadata.description ?? null,
        operatingSystems: { "linux": false, "windows": false, "android": false, "ios": false, "mac": false },
        runtimePlatforms: [],
        externalIdForSource: recordSoftwareItem.conceptrecid,
        sourceSlug: source.slug,
        license: recordSoftwareItem.metadata.license?.id ?? null,
        similarSoftwareExternalDataItems: [],
        image: null,
        keywords: recordSoftwareItem.metadata.keywords ?? [],
        customAttributes: undefined,
        isLibreSoftware: null,
        url: null,
        codeRepositoryUrl: recordSoftwareItem.metadata?.custom?.["code:codeRepository"] ?? null,
        softwareHelp: null,
        latestVersion:
            recordSoftwareItem.metadata.version && publicationIso
                ? {
                      version: recordSoftwareItem.metadata.version,
                      releaseDate: publicationIso
                  }
                : null
    };
};
