// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import type {
    GetSoftwareExternalDataOptions,
    SoftwareExternalDataOption
} from "../../ports/GetSoftwareExternalDataOptions";
import type { Language } from "../../ports/GetSoftwareExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { freeSoftwareLicensesWikidataIds } from "./getWikidataSoftware";
import { makeWikidataAPIAgent } from "./ApiAgent";
import { convertSourceConfigToRequestInit } from "../../../tools/sourceConfig";

// One Wikidata IP is shared by every API caller, so popular autocomplete queries
// (e.g. typing "postgres") used to fan out into duplicate upstream requests and
// burn the per-minute rate budget. Cache by (slug, language, queryString) for
// 2 minutes so repeats answer from memory; preFetch refreshes hot keys in the
// background near expiry.
const memoizedFetchOptions = memoize(
    async (params: {
        sourceSlug: string;
        language: Language;
        queryString: string;
        source: Source;
    }): Promise<SoftwareExternalDataOption[]> => {
        const { source, queryString, language } = params;
        const wikipediaAgent = makeWikidataAPIAgent(source);

        const baseRequestInit = convertSourceConfigToRequestInit(source.configuration);
        const requestInit: RequestInit = {
            ...baseRequestInit,
            headers: {
                ...(baseRequestInit.headers as Record<string, string> | undefined),
                Accept: "application/json"
            }
        };

        const searchUrl = [
            `${source.url}/w/api.php?action=wbsearchentities&format=json`,
            `search=${encodeURIComponent(queryString)}`,
            `language=${language}`
        ].join("&");

        const response = await fetch(searchUrl, requestInit).catch(() => undefined);
        const contentType = response?.headers.get("content-type") ?? "";
        if (!response?.ok || !contentType.includes("json")) {
            console.warn(
                `[wikidata.getSoftwareOptions] non-JSON search response (status=${response?.status ?? "n/a"}, content-type=${contentType}); returning no suggestions.`
            );
            return [];
        }
        const results = (await response.json().catch(() => undefined)) as
            | { search: { id: string; display: { description?: { value?: string } }; label?: string }[] }
            | undefined;
        if (!results?.search) return [];

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
            // null → license unknown (e.g. wikidata entity has no P275 claim, or
            // the wbgetentities call failed). Don't conflate with `false` which
            // means "verified non-libre". UI/import path decides how to treat
            // unknowns.
            "isLibreSoftware": (() => {
                const licenseId = licensesById[id];
                return licenseId === undefined ? null : freeSoftwareLicensesWikidataIds.includes(licenseId);
            })()
        }));
    },
    {
        promise: true,
        maxAge: 120 * 1000,
        max: 500,
        preFetch: true,
        normalizer: ([{ sourceSlug, language, queryString }]) => `${sourceSlug}|${language}|${queryString}`
    }
);

export const getWikidataSoftwareOptions: GetSoftwareExternalDataOptions = async ({ queryString, language, source }) => {
    if (source.kind !== "wikidata") throw new Error(`Not a wikidata source, was : ${source.kind}`);
    return memoizedFetchOptions({ sourceSlug: source.slug, language, queryString, source });
};
