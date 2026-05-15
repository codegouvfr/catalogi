// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

interface WikidataValue {
    type: string;
    content?: string | number | { [key: string]: any } | Array<unknown>;
}

interface WikidataProperty {
    id: string;
    data_type: string;
}

interface WikidataStatement {
    id: string;
    rank: string;
    qualifiers?: Array<{
        property: WikidataProperty;
        value: WikidataValue;
    }>;
    references?: Array<{
        hash: string;
        parts: Array<{
            property: WikidataProperty;
            value: WikidataValue;
        }>;
    }>;
    property: WikidataProperty;
    value: WikidataValue;
}

interface WikidataStatements {
    [propertyId: string]: WikidataStatement[];
}

interface WikidataLabels {
    [lang: string]: string;
}

interface WikidataDescriptions {
    [lang: string]: string;
}

interface WikidataAliases {
    [lang: string]: string[];
}

interface WikidataSitelink {
    title: string;
    badges: string[];
    url: string;
}

interface WikidataSitelinks {
    [site: string]: WikidataSitelink;
}

export interface RestWikidataEntity {
    type: string;
    id: string;
    labels: WikidataLabels;
    descriptions: WikidataDescriptions;
    aliases: WikidataAliases;
    statements: WikidataStatements;
    sitelinks: WikidataSitelinks;
}

export const fetchRestWikidataEntity = async (params: {
    entityId: string;
    requestInit?: RequestInit;
    rateLimitRetryDuration?: number;
}): Promise<RestWikidataEntity | undefined> => {
    const { entityId, requestInit = {}, rateLimitRetryDuration = 5000 } = params;
    const url = `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${entityId}`;

    try {
        const response = await fetch(url, requestInit);

        if (response.status === 429) {
            console.debug("Wikidata Busy, retrying in ", rateLimitRetryDuration);
            await new Promise(resolve => setTimeout(resolve, rateLimitRetryDuration));
            return fetchRestWikidataEntity(params);
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: RestWikidataEntity = await response.json();
        return data;
    } catch (error) {
        console.error("Erreur lors de la récupération de l'entité Wikidata :", error);
        return undefined;
    }
};
