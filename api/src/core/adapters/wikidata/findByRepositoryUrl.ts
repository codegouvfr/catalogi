// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { FindSoftwareByRepositoryUrl } from "../../ports/SourceGateway";
import { convertSourceConfigToRequestInit } from "../../../tools/sourceConfig";

type SearchResponse = {
    query?: { pages?: { title: string; entityterms?: { label?: string[] } }[] };
};

// P1324 = source code repository URL. The search api is not rate limited like the
// SPARQL endpoint and answers in a few hundred milliseconds.
export const findWikidataByRepositoryUrl: FindSoftwareByRepositoryUrl = async ({ repoUrls, source, signal }) => {
    // `|` separates the statements and `"` closes the search: urls holding them are not searchable.
    const searchableUrls = repoUrls.filter(url => !url.includes("|") && !url.includes('"'));
    if (searchableUrls.length === 0) return undefined;
    const statements = searchableUrls.map(url => `P1324=${url}`).join("|");

    const searchParams = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        generator: "search",
        gsrsearch: `haswbstatement:"${statements}"`,
        gsrlimit: "2",
        prop: "entityterms",
        wbetterms: "label",
        wbetlanguage: "fr"
    });

    const baseRequestInit = convertSourceConfigToRequestInit(source.configuration);
    const response = await fetch(`${source.url}/w/api.php?${searchParams}`, {
        ...baseRequestInit,
        signal,
        headers: {
            ...(baseRequestInit.headers as Record<string, string> | undefined),
            Accept: "application/json",
            "User-Agent": "catalogi-sill (https://code.gouv.fr/sill)"
        }
    });
    if (!response.ok) throw new Error(`Wikidata search failed with status ${response.status}`);

    const pages = ((await response.json()) as SearchResponse).query?.pages ?? [];

    // Several items citing the same repository (software and its fork, library and app...)
    // cannot be told apart here.
    if (pages.length !== 1) return undefined;

    return {
        externalId: pages[0].title,
        name: pages[0].entityterms?.label?.[0],
        url: `${source.url}/wiki/${pages[0].title}`
    };
};
