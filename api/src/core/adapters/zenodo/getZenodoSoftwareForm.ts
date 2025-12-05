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

const formatRecordToSoftwareFormData = (recordSoftwareItem: Zenodo.Record, source: Source): SoftwareFormData => {
    return {
        softwareName: recordSoftwareItem.title,
        softwareDescription: recordSoftwareItem.metadata.description ?? "",
        softwareType: {
            // Probably wrong
            type: "desktop/mobile",
            os: { "linux": false, "windows": false, "android": false, "ios": false, "mac": false }
        },
        externalIdForSource: recordSoftwareItem.id.toString(),
        sourceSlug: source.slug,
        softwareLicense: recordSoftwareItem.metadata.license?.id ?? "Copyright",
        softwareMinimalVersion: undefined,
        similarSoftwareExternalDataItems: [],
        softwareLogoUrl: undefined,
        softwareKeywords: recordSoftwareItem.metadata.keywords ?? [],

        customAttributes: undefined
    };
};
