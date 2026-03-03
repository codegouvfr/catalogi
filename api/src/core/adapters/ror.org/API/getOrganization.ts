// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { identifersUtils } from "../../../../tools/identifiersTools";
import { SchemaOrganization } from "../../dbApi/kysely/kysely.database";

type RORAdmin = {
    created: {
        date: string;
        schema_version: string;
    };
    last_modified: {
        date: string;
        schema_version: string;
    };
};

type RORExternalId = {
    all: string[];
    preferred: string | null;
    type: string;
};

type RORLink = {
    type: string;
    value: string;
};

type RORGeonamesDetails = {
    continent_code: string;
    continent_name: string;
    country_code: string;
    country_name: string;
    country_subdivision_code: string;
    country_subdivision_name: string;
    lat: number;
    lng: number;
    name: string;
};

type RORLocation = {
    geonames_details: RORGeonamesDetails;
    geonames_id: number;
};

type RORName = {
    lang: string | null;
    types: string[];
    value: string;
};

type RORRelationship = {
    label: string;
    type: string;
    id: string;
};

interface RorOrganization {
    admin: RORAdmin;
    domains: string[];
    established: number;
    external_ids: RORExternalId[];
    id: string;
    links: RORLink[];
    locations: RORLocation[];
    names: RORName[];
    relationships: RORRelationship[];
    status: string;
    types: string[];
}

export const fetchRorOrganizationById = async (rorId: string): Promise<SchemaOrganization | undefined> => {
    const url = `https://api.ror.org/v2/organizations/${rorId}`;

    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: RorOrganization | undefined = await response.json();
        if (data) {
            return rorToSchemaOrganization(data);
        }
        return undefined;
    } catch (error) {
        console.error(`Erreur lors de la récupération de l'organisation ROR (${rorId}):`, error);
        return undefined;
    }
};

function rorToSchemaOrganization(rorOrganization: RorOrganization): SchemaOrganization {
    const schemaOrg: SchemaOrganization = {
        "@type": "Organization",
        name: rorOrganization.names.filter(org => org.types.includes("ror_display"))[0].value,
        foundingDate: rorOrganization.established ? rorOrganization.established.toString() : undefined,
        additionalType: rorOrganization.types,
        identifiers: [identifersUtils.makeRorOrgaIdentifer({ rorId: rorOrganization.id })]
    };

    // Ajout de l'accronyname  (si disponible)
    const accronyname = rorOrganization.names.filter(org => org.types.includes("acronym"))[0];
    if (accronyname?.value) {
        schemaOrg.alternateName = [accronyname.value];
    }

    // Ajouter l'URL officielle (si disponible)
    const websiteUrl = rorOrganization?.links?.filter(link => link.type === "website");
    if (websiteUrl && websiteUrl.length > 0) {
        schemaOrg.url = websiteUrl[0].value;
    }

    // Ajouter les identifiants externes (ROR, ISNI, Wikidata, etc.)
    rorOrganization.external_ids.forEach(id => {
        if (!id.type) return; // Ignorer si le type n'est pas défini
        schemaOrg.identifiers = schemaOrg.identifiers ?? [];
        const value = id.preferred ?? id.all?.[0];
        switch (id.type) {
            case "wikidata":
                schemaOrg.identifiers.push(identifersUtils.makeWikidataIdentifier({ wikidataId: value }));
                break;

            case "fundref":
                schemaOrg.identifiers.push(
                    identifersUtils.makeCrossRefIdentifier({ crossRefId: value, type: id.type })
                );
                break;

            case "grid":
                schemaOrg.identifiers.push(identifersUtils.makeGridIdentifier({ gridId: value }));

                break;

            case "isni":
                schemaOrg.identifiers.push(identifersUtils.makeINSIIdentifier({ insiId: value }));
                break;

            default:
                // Ignorer les types inconnus
                break;
        }
    });

    // Ajouter l'adresse
    if (rorOrganization?.locations?.[0]?.geonames_details) {
        schemaOrg.address = {
            "@type": "PostalAddress" as const,
            addressLocality: rorOrganization.locations[0].geonames_details.name,
            addressCountry: rorOrganization.locations[0].geonames_details.country_name
        };
    }

    // Ajouter les organization parentes
    const parentsOrgs = rorOrganization.relationships.filter(org => org.type === "parent");
    schemaOrg.parentOrganizations = parentsOrgs.map(parOrg => {
        return {
            "@type": "Organization",
            name: parOrg.label,
            identifers: [identifersUtils.makeRorOrgaIdentifer({ rorId: parOrg.id })]
        };
    });

    return schemaOrg;
}
