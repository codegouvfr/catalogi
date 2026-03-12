// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SchemaOrganization, SchemaPostalAddress } from "../../dbApi/kysely/kysely.database";

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

export interface WikidataEntity {
    type: string;
    id: string;
    labels: WikidataLabels;
    descriptions: WikidataDescriptions;
    aliases: WikidataAliases;
    statements: WikidataStatements;
    sitelinks: WikidataSitelinks;
}

export const fetchWikidataEntity = async (entityId: string): Promise<WikidataEntity | undefined> => {
    const url = `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${entityId}`;

    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: WikidataEntity = await response.json();
        return data;
    } catch (error) {
        console.error("Erreur lors de la récupération de l'entité Wikidata :", error);
        return undefined;
    }
};

interface WikimediaImageInfo {
    query: {
        pages: {
            [key: string]: {
                imageinfo?: Array<{ url: string }>;
            };
        };
    };
}

async function getWikimediaFileUrl(fileName: string): Promise<string> {
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json&origin=*`;

    try {
        const response = await fetch(apiUrl);
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
}

export const convertWikidataToSchemaOrganization = (params: {
    organisationEntity: WikidataEntity;
    streetEntity?: WikidataEntity;
    countryEntity?: WikidataEntity;
    logoUrl?: string;
}): SchemaOrganization => {
    const { organisationEntity, streetEntity, countryEntity, logoUrl } = params;

    // Récupérer le nom principal
    const name = organisationEntity.labels?.fr || organisationEntity.labels?.en;

    // Récupérer les noms alternatifs (acronymes)
    const alternateName = [...new Set(organisationEntity.aliases?.fr || [])];

    // Récupérer la description
    const description = organisationEntity.descriptions?.fr || "";

    // Récupérer l'URL principale
    const url = organisationEntity.statements?.P856?.[0]?.value?.content as string | undefined;

    // Récupérer la date de fondation
    let foundingDate: string | undefined;
    const foundingDateStatement = organisationEntity.statements?.P571?.[0];
    const content = foundingDateStatement?.value?.content;
    if (foundingDateStatement && typeof content === "object" && content !== null && "time" in content) {
        if (content.time[0] === "+") {
            foundingDate = new Date(content.time.slice(1, content.time.length - 1)).getFullYear().toString();
        } else {
            foundingDate = new Date(content.time).getFullYear().toString();
        }
    }

    // Récupérer l'adresse
    let address: SchemaPostalAddress | undefined;
    const addressStatement = organisationEntity.statements?.P159?.[0];
    if (addressStatement) {
        const qualifiers = addressStatement.qualifiers || [];
        let postalCode: string | undefined;
        let streetAddress: string | undefined;

        for (const qualifier of qualifiers) {
            if (qualifier.property.id === "P670" && typeof qualifier.value.content === "string") {
                streetAddress = qualifier.value.content;
            } else if (qualifier.property.id === "P281" && typeof qualifier.value.content === "string") {
                postalCode = qualifier.value.content;
            } else if (
                qualifier.property.id === "P6375" &&
                typeof qualifier.value.content === "object" &&
                "text" in qualifier.value.content
            ) {
                streetAddress = qualifier.value.content.text;
            }
        }

        if (streetEntity?.labels?.["fr"]) {
            streetAddress += ", " + streetEntity?.labels?.["fr"];
        }

        address = {
            "@type": "PostalAddress",
            streetAddress,
            postalCode,
            addressCountry: countryEntity?.labels?.["fr"]
        };
    }

    // Créer l'objet SchemaOrganization
    const organization: SchemaOrganization = {
        "@type": "Organization",
        name,
        url,
        // identifiers,
        foundingDate,
        alternateName,
        description,
        address,
        ...(logoUrl ? { image: logoUrl } : {})
    };

    return organization;
};

export const getOrganizationFromApi = async (entityId: string): Promise<SchemaOrganization | undefined> => {
    const org = await fetchWikidataEntity(entityId);
    if (!org) return undefined;

    const addressEntityId = org?.statements?.P159?.[0].qualifiers?.find(statement => statement.property.id === "P669")
        ?.value.content as string | undefined;
    const addressEntity = addressEntityId ? await fetchWikidataEntity(addressEntityId) : undefined;

    const countryWikidataId =
        (addressEntity?.statements?.P17?.[0].value.content as string | undefined) ??
        (org?.statements?.P17?.[0].value.content as string | undefined) ??
        undefined;
    const countryEntity = countryWikidataId ? await fetchWikidataEntity(countryWikidataId) : undefined;

    // Récupération du logo
    const logoFileName = org.statements?.P154?.[0];
    let logoUrl: string | undefined;
    if (
        logoFileName &&
        logoFileName.property.data_type === "commonsMedia" &&
        logoFileName.value.type === "value" &&
        logoFileName.value.content &&
        typeof logoFileName.value.content === "string"
    ) {
        logoUrl = await getWikimediaFileUrl(logoFileName.value.content);
    }

    return convertWikidataToSchemaOrganization({
        organisationEntity: org,
        streetEntity: addressEntity,
        countryEntity,
        logoUrl
    });
};
