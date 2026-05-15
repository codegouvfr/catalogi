// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

type WbgetentitiesResponse = {
    entities?: Record<
        string,
        {
            id: string;
            claims?: Record<
                string,
                Array<{
                    rank?: "preferred" | "normal" | "deprecated";
                    mainsnak?: {
                        snaktype?: string;
                        datavalue?: { value?: { id?: string } };
                    };
                }>
            >;
        }
    >;
};

const pickPreferredP275 = (
    claims: NonNullable<NonNullable<WbgetentitiesResponse["entities"]>[string]["claims"]>
): string | undefined => {
    const statements = (claims.P275 ?? [])
        .filter(s => s.rank !== "deprecated" && s.mainsnak?.snaktype === "value")
        .sort((a, b) => (b.rank === "preferred" ? 1 : 0) - (a.rank === "preferred" ? 1 : 0));
    return statements[0]?.mainsnak?.datavalue?.value?.id;
};

/**
 * Fetch the license (P275) for a batch of wikidata entities using the same
 * `www.wikidata.org/w/api.php` endpoint that `wbsearchentities` uses. Avoids
 * `query.wikidata.org/sparql`, which is rate-limited and frequently returns
 * HTML error pages on overload.
 *
 * Returns a map of `wikidataId -> license entity id`. Entities without a P275
 * claim are simply absent from the map. Memoized per (sourceUrl, ids) for 2
 * minutes — autocomplete frequently asks for the same id sets in succession.
 */
const fetchLicensesUncached = async (params: {
    wikidataIds: string[];
    sourceUrl: string;
    requestInit?: RequestInit;
}): Promise<Record<string, string>> => {
    const { wikidataIds, sourceUrl, requestInit } = params;
    if (wikidataIds.length === 0) return {};

    const url = `${sourceUrl}/w/api.php?action=wbgetentities&format=json&props=claims&ids=${wikidataIds.join("|")}`;
    // Identify ourselves so Wikidata applies a friendlier rate limit than the anonymous bucket.
    const headers = {
        ...((requestInit?.headers as Record<string, string> | undefined) ?? {}),
        Accept: "application/json",
        "User-Agent": "catalogi-sill (https://code.gouv.fr/sill)"
    };
    const response = await fetch(url, { ...requestInit, headers }).catch(() => undefined);
    if (!response?.ok) {
        console.warn(`[wikidata.getLicenses] wbgetentities failed (status=${response?.status ?? "n/a"})`);
        return {};
    }
    const data = (await response.json().catch(() => undefined)) as WbgetentitiesResponse | undefined;
    if (!data?.entities) return {};

    const out: Record<string, string> = {};
    for (const [wikidataId, entity] of Object.entries(data.entities)) {
        if (!entity.claims) continue;
        const licenseId = pickPreferredP275(entity.claims);
        if (licenseId !== undefined) out[wikidataId] = licenseId;
    }
    return out;
};

const memoizedFetchLicenses = memoize(fetchLicensesUncached, {
    promise: true,
    maxAge: 120 * 1000,
    max: 500,
    preFetch: true,
    normalizer: ([{ sourceUrl, wikidataIds }]) => `${sourceUrl}|${[...wikidataIds].sort().join(",")}`
});

export const getLicenses = (params: {
    wikidataIds: string[];
    sourceUrl: string;
    requestInit?: RequestInit;
}): Promise<Record<string, string>> => memoizedFetchLicenses(params);
