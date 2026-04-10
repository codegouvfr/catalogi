// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export const getLicenses = async (params: { wikidataIds: string[]; requestInit?: RequestInit }) => {
    const { wikidataIds, requestInit = {} } = params;
    const propertyId = "P275"; // license
    const wikidataIdString = wikidataIds.map(id => "wd:" + id).join(" ");
    const query = `SELECT ?item ?itemLabel ?license ?licenseLabel WHERE {
        VALUES ?item { ${wikidataIdString} }
        ?item wdt:${propertyId} ?license.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url, requestInit);
    const data = await response.json();

    // Group the results by the Wikidata ID
    const groupedData: Record<
        string,
        {
            item: string;
            itemLabel: string;
            license: string;
            licenseLabel: string;
        }
    > = {};

    data.results.bindings.forEach((binding: any) => {
        const wikidataId = binding.item.value.split("/").pop();
        if (!groupedData[wikidataId]) {
            groupedData[wikidataId] = {
                "item": binding.item.value,
                "itemLabel": binding.itemLabel.value,
                "license": binding.license.value,
                "licenseLabel": binding.licenseLabel.value
            };
        }
    });

    return Object.fromEntries(
        Object.entries(groupedData).map(([wikidataId, { license }]) => [wikidataId, license.split("/").reverse()[0]])
    );
};
