// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

export type WikimediaImageInfo = {
    query: {
        pages: {
            [key: string]: {
                imageinfo?: Array<{ url: string }>;
            };
        };
    };
};

const MAX_429_RETRIES = 5;

export const getWikimediaFileUrl = async (params: {
    fileName: string;
    requestInit?: RequestInit;
    rateLimitRetryDuration?: number;
    attempt?: number;
}): Promise<string> => {
    const { fileName, requestInit = {}, rateLimitRetryDuration = 5000, attempt = 0 } = params;
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json&origin=*`;

    try {
        const response = await fetch(apiUrl, requestInit);

        if (response.status === 429) {
            if (attempt >= MAX_429_RETRIES) throw new Error(`MAX_429_RETRIES reached ${attempt}/${MAX_429_RETRIES}`);
            console.debug("Wikidata Busy, retrying in ", rateLimitRetryDuration);
            await new Promise(resolve => setTimeout(resolve, rateLimitRetryDuration));
            return getWikimediaFileUrl({ attempt: attempt + 1, ...params });
        }

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data: WikimediaImageInfo = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        const imageInfo = pages[pageId].imageinfo;

        if (!imageInfo || imageInfo.length === 0) {
            throw new Error("Aucune URL trouvée pour ce fichier.");
        }

        return imageInfo[0].url;
    } catch (error) {
        console.error("Erreur lors de la récupération de l'URL du fichier:", error);
        throw error;
    }
};
