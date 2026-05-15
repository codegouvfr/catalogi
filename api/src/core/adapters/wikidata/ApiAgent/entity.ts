// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

import { type WikidataEntity, type LocalizedString } from "../../../../tools/WikidataEntity";

export class WikidataFetchError extends Error {
    constructor(public readonly status: number | undefined) {
        super(`Wikidata fetch error status: ${status}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";

const buildHeaders = (requestInit: RequestInit): Record<string, string> => ({
    ...((requestInit.headers as Record<string, string> | undefined) ?? {}),
    Accept: "application/json",
    "User-Agent": "catalogi-sill (https://code.gouv.fr/sill)"
});

// `mul` is wikidata's multilingual label (used for names identical across
// languages, e.g. Q15777 "C" has no `en` label but `mul = "C"`). Not in the
// canonical WikidataEntity type because most consumers ignore it.
type LabelsWithMul = LocalizedString.Single & { mul?: { language: string; value: string } };
type WbEntry = ((Partial<WikidataEntity> & { labels?: LabelsWithMul }) & { id: string }) | { id: string; missing: "" };

type WbgetentitiesResponse = {
    entities?: Record<string, WbEntry>;
    error?: { code: string; info: string };
};

const MAX_429_RETRIES = 3;

const callWbgetentities = async (
    params: { ids: string[]; props: string; languages?: string; requestInit: RequestInit },
    attempt = 0
): Promise<WbgetentitiesResponse | undefined> => {
    const { ids, props, languages, requestInit } = params;
    if (ids.length === 0) return { entities: {} };

    const url = [
        `${WIKIDATA_API_URL}?action=wbgetentities&format=json`,
        `ids=${ids.join("|")}`,
        `props=${props}`,
        ...(languages ? [`languages=${languages}`] : [])
    ].join("&");

    const res = await fetch(url, { ...requestInit, headers: buildHeaders(requestInit) }).catch(() => undefined);

    if (res === undefined) return undefined;

    if (res.status === 429) {
        if (attempt >= MAX_429_RETRIES) return undefined;
        await new Promise(resolve => setTimeout(resolve, 300));
        return callWbgetentities(params, attempt + 1);
    }

    if (!res.ok) return undefined;

    return (await res.json().catch(() => undefined)) as WbgetentitiesResponse | undefined;
};

const isMissing = (entry: WbEntry): entry is { id: string; missing: "" } => "missing" in entry;

/**
 * Fetch a single wikidata entity. Uses the `wbgetentities` API with narrow
 * `props=labels|descriptions|aliases|claims` and `languages=en|fr` so the
 * response is a fraction of what `Special:EntityData/<id>.json` returns
 * (which always includes every sitelink and every language).
 */
export async function fetchEntity(params: {
    wikidataId: string;
    requestInit?: RequestInit;
}): Promise<{ entity: WikidataEntity }> {
    const { wikidataId, requestInit = {} } = params;

    const data = await callWbgetentities({
        ids: [wikidataId],
        props: "labels|descriptions|aliases|claims",
        languages: "en|fr",
        requestInit
    });

    if (data === undefined || data.error) {
        throw new WikidataFetchError(undefined);
    }

    const entry = data.entities?.[wikidataId];
    if (entry === undefined || isMissing(entry)) {
        throw new WikidataFetchError(404);
    }

    const entity = entry as WikidataEntity;

    const displayName =
        entity.labels?.en?.value ??
        entity.labels?.fr?.value ??
        entity.aliases?.en?.[0]?.value ??
        entity.aliases?.fr?.[0]?.value ??
        entity.id;
    console.info(`   -> fetched wiki soft : ${displayName}`);

    return { entity };
}

export type EntityShortInfo = { labelEn?: string; labelFr?: string; labelMul?: string; aliasEn?: string };

/**
 * Batch-fetch labels + first English alias of multiple wikidata entities in a
 * single `wbgetentities` call. Used for license / programming-language
 * lookups where we only need a short string per entity. Skipping `claims`
 * (which we never read for those) keeps each entry to ~1KB instead of the
 * ~hundreds-of-KB full entity blob. Never throws — returns `{}` on failure.
 *
 * Returns a map of `wikidataId -> {labelEn?, labelFr?, labelMul?, aliasEn?}`.
 */
export const fetchEntityAliasesEn = async (params: {
    wikidataIds: string[];
    requestInit?: RequestInit;
}): Promise<Record<string, EntityShortInfo>> => {
    const { wikidataIds, requestInit = {} } = params;
    if (wikidataIds.length === 0) return {};

    const data = await callWbgetentities({
        ids: wikidataIds,
        props: "labels|aliases",
        languages: "en|fr|mul",
        requestInit
    });

    if (data === undefined || !data.entities) return {};

    const out: Record<string, EntityShortInfo> = {};
    for (const [id, entry] of Object.entries(data.entities)) {
        if (isMissing(entry)) continue;
        out[id] = {
            labelEn: entry.labels?.en?.value,
            labelFr: entry.labels?.fr?.value,
            labelMul: entry.labels?.mul?.value,
            aliasEn: entry.aliases?.en?.[0]?.value
        };
    }
    return out;
};
