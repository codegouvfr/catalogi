// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import { SoftwareFormData, Source } from "../../usecases/readWriteSillData";
import { makeZenodoApi } from "./zenodoAPI";
import { Zenodo } from "./zenodoAPI/type";
import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";

export const getZenodoSoftwareFormData: GetSoftwareFormData = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }) => {
        if (source.kind !== "Zenodo" && source.url !== "https://zenodo.org/")
            throw new Error(`Not a Zenodo source, was : ${source.kind}`);

        const zenodoApi = makeZenodoApi();
        const record = await zenodoApi.records.get(Number(externalId));

        if (!record) return undefined;
        if (record.metadata.resource_type.type !== "software")
            throw new TypeError(`The record corresponding at ${externalId} is not a software`);

        return formatRecordToSoftwareFormData(record, source);
    }
);

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
