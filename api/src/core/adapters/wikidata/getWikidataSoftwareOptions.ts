// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { GetSoftwareExternalDataOptions } from "../../ports/GetSoftwareExternalDataOptions";
import { freeSoftwareLicensesWikidataIds } from "./getWikidataSoftware";
import { makeWikidataAPIAgent } from "./ApiAgent";
import { convertSourceConfigToRequestInit } from "../../../tools/sourceConfig";

export const getWikidataSoftwareOptions: GetSoftwareExternalDataOptions = async ({ queryString, language, source }) => {
    if (source.kind !== "wikidata") throw new Error(`Not a wikidata source, was : ${source.kind}`);

    const wikipediaAgent = makeWikidataAPIAgent(source);

    const results: {
        search: {
            id: string;
            display: { description?: { value?: string } };
            label?: string;
        }[];
    } = (await fetch(
        [
            `${source.url}/w/api.php?action=wbsearchentities&format=json`,
            `search=${encodeURIComponent(queryString)}`,
            `language=${language}`
        ].join("&"),
        convertSourceConfigToRequestInit(source.configuration)
    ).then(response => response.json())) as any;

    const arr = results.search.map(entry => ({
        "id": entry.id,
        "description": entry.display.description?.value ?? "",
        "name": entry.label ?? ""
    }));

    const licensesById = await wikipediaAgent.getLicenses(arr.map(({ id }) => id));

    return arr.map(({ id, name, description }) => ({
        externalId: id,
        sourceSlug: source.slug,
        name,
        description,
        "isLibreSoftware": (() => {
            const licenseId = licensesById[id];

            return licenseId === undefined ? false : freeSoftwareLicensesWikidataIds.includes(licenseId);
        })()
    }));
};
