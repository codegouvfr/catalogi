// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { GetSoftwareExternalDataOptions, SoftwareExternalDataOption } from "../../ports/GetSoftwareExternalDataOptions";
import { makeZenodoApi } from "./zenodoAPI";
import { Zenodo } from "./zenodoAPI/type";
import { Source } from "../../usecases/readWriteSillData";

export const getZenodoSoftwareOptions: GetSoftwareExternalDataOptions = async ({ source, queryString }) => {
    if (source.kind !== "Zenodo" && source.url !== "https://zenodo.org/")
        throw new Error(`Not a Zenodo source, was : ${source.kind}`);

    const zenodoApi = makeZenodoApi();
    const records = await zenodoApi.records.getByNameAndType(queryString, "software");

    if (!records.hits || records.hits.hits.length === 0) return [];

    return records.hits.hits.map(record => formatRecordToSoftwareOption(record, source));
};

function formatRecordToSoftwareOption(record: Zenodo.Record, source: Source): SoftwareExternalDataOption {
    return {
        externalId: record.id.toString(),
        name: record.title,
        description: record.metadata.description ?? "",
        isLibreSoftware: record.metadata.access_right === "open", // Not sure
        sourceSlug: source.slug
    };
}
