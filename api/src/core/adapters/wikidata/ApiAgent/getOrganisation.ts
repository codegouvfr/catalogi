// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

import { SchemaOrganization, SchemaPostalAddress } from "../../dbApi/kysely/kysely.database";
import { fetchRestWikidataEntity, RestWikidataEntity } from "./restApi";
import { getWikimediaFileUrl } from "./wikimedia";

export const convertWikidataToSchemaOrganization = (params: {
    organisationEntity: RestWikidataEntity;
    streetEntity?: RestWikidataEntity;
    countryEntity?: RestWikidataEntity;
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

export const getOrganisationFromApi = async (params: {
    entityId: string;
    requestInit?: RequestInit;
    rateLimitRetryDuration?: number;
}): Promise<SchemaOrganization | undefined> => {
    const org = await fetchRestWikidataEntity(params);
    if (!org) return undefined;

    const addressEntityId = org?.statements?.P159?.[0].qualifiers?.find(statement => statement.property.id === "P669")
        ?.value.content as string | undefined;
    const addressEntity = addressEntityId
        ? await fetchRestWikidataEntity({ ...params, entityId: addressEntityId })
        : undefined;

    const countryWikidataId =
        (addressEntity?.statements?.P17?.[0].value.content as string | undefined) ??
        (org?.statements?.P17?.[0].value.content as string | undefined) ??
        undefined;
    const countryEntity = countryWikidataId
        ? await fetchRestWikidataEntity({ ...params, entityId: countryWikidataId })
        : undefined;

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
        logoUrl = await getWikimediaFileUrl({ ...params, fileName: logoFileName.value.content });
    }

    return convertWikidataToSchemaOrganization({
        organisationEntity: org,
        streetEntity: addressEntity,
        countryEntity,
        logoUrl
    });
};
