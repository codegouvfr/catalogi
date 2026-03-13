// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { type WikidataEntity } from "../../../../tools/WikidataEntity";

export class WikidataFetchError extends Error {
    constructor(public readonly status: number | undefined) {
        super(`Wikidata fetch error status: ${status}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export async function fetchEntity(params: {
    wikidataId: string;
    requestInit?: RequestInit;
}): Promise<{ entity: WikidataEntity }> {
    const { wikidataId, requestInit = {} } = params;

    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`, requestInit).catch(
        () => undefined
    );

    if (res === undefined) {
        throw new WikidataFetchError(undefined);
    }

    if (res.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return fetchEntity(params);
    }

    if (res.status === 404) {
        throw new WikidataFetchError(res.status);
    }

    const json = await res.json();

    const entity = Object.values(json["entities"])[0] as WikidataEntity;

    console.info(`   -> fetched wiki soft : ${entity.aliases.en?.[0]?.value || entity.aliases.fr?.[0]?.value}`);

    return { entity };
}
