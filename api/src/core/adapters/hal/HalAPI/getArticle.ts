// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { HAL } from "./types/HAL";

const halArticleFieldsToReturn: (keyof HAL.API.Article)[] = ["en_title_s", "fr_title_s", "docid", "title_s"];

export async function getArticleById(articleHalId: string): Promise<HAL.API.Article> {
    // CURATED - FIX HAL
    // When doing a research with HAL id with ***v* -> Don't work
    const idForAPI =
        articleHalId.substring(articleHalId.length - 2, articleHalId.length - 1) === "v"
            ? articleHalId.substring(0, articleHalId.length - 2)
            : articleHalId;
    // END OF CURATED - FIX HAL

    // Get domain using code
    const url = `https://api.archives-ouvertes.fr/search/?q=halId_id:${idForAPI}&fl=${halArticleFieldsToReturn.join(",")}`;

    const res = await fetch(url).catch(err => {
        console.error(err);
        throw new HAL.API.FetchError(undefined);
    });

    if (res.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return getArticleById(articleHalId);
    }

    if (res.status === 404) {
        throw new HAL.API.FetchError(res.status);
    }

    const json = await res.json();

    if (json.response.docs.length > 1) console.warn(`HAL getArticleById multiples article for id : ${articleHalId}`);

    return json.response.docs[0];
}
