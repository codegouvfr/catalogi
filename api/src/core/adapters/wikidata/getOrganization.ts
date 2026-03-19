// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

type SparqlResult = {
    head: {
        vars: string[];
    };
    results: {
        bindings: Array<{
            item: {
                type: string;
                value: string; // Exemple : "http://www.wikidata.org/entity/Q217271"
            };
        }>;
    };
};

export const searchOrganizationhWikidataItemId = async (rorId: string): Promise<string | undefined> => {
    const query = `
    SELECT DISTINCT ?item
    WHERE {
      ?item wdt:P6782 "${rorId}" .
    }
  `;

    const encodedQuery = encodeURIComponent(query);
    const url = `https://query.wikidata.org/sparql?query=${encodedQuery}&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: SparqlResult = await response.json();

        if (data.results.bindings.length > 0) {
            const itemUri = data.results.bindings[0].item.value;
            const itemId = itemUri.split("/")[4];
            return itemId;
        } else {
            console.log("Aucun résultat trouvé.");
            return undefined;
        }
    } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
        return undefined;
    }
};
