// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import { GetSoftwareExternalData, SoftwareExternalData } from "../../ports/GetSoftwareExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { SchemaOrganization } from "../dbApi/kysely/kysely.database";
import { identifersUtils } from "../../../tools/identifiersTools";
import { getCnllPrestatairesSill } from "../getCnllPrestatairesSill";
import { CnllPrestatairesSill } from "../../ports/GetCnllPrestatairesSill";

export const getCNLLSoftwareExternalData: GetSoftwareExternalData = memoize(
    async ({
        externalId,
        source
    }: {
        externalId: string;
        source: Source;
    }): Promise<SoftwareExternalData | undefined> => {
        if (source.kind !== "CNLL") throw new Error("This source if not compatible with CNLL Adapter");

        const cnllProviders = await getCnllPrestatairesSill();

        const providersForExternalId = cnllProviders.find(element => element.sill_id.toString() === externalId);

        if (!providersForExternalId) return undefined;

        return formatCNLLProvidersToExternalData(providersForExternalId, source);
    }
);

const cnllProviderToCMProdivers = (provider: CnllPrestatairesSill.Prestataire): SchemaOrganization => {
    const cnllId = provider.url.split("/").at(-1) ?? provider.nom;

    return {
        "@type": "Organization" as const,
        name: provider.nom,
        identifiers: [
            ...(provider.url
                ? [
                      identifersUtils.makeCNLLIdentifier({
                          cNNLId: cnllId,
                          url: provider.url,
                          additionalType: "Organization"
                      })
                  ]
                : []),
            identifersUtils.makeSIRENIdentifier({
                SIREN: provider.siren,
                additionalType: "Organization"
            })
        ]
    };
};

const formatCNLLProvidersToExternalData = (
    cnllProdivers: CnllPrestatairesSill,
    source: Source
): SoftwareExternalData => ({
    externalId: cnllProdivers.sill_id.toString(),
    sourceSlug: source.slug,
    developers: [],
    label: { "fr": cnllProdivers.nom },
    description: { "fr": "" },
    isLibreSoftware: true,
    logoUrl: undefined,
    websiteUrl: undefined,
    sourceUrl: undefined,
    documentationUrl: undefined,
    license: undefined,
    softwareVersion: undefined,
    keywords: [],
    programmingLanguages: [],
    applicationCategories: [],
    publicationTime: undefined,
    referencePublications: [],
    identifiers: [
        identifersUtils.makeCNLLIdentifier({
            cNNLId: cnllProdivers.sill_id.toString()
        })
    ],
    repoMetadata: undefined,
    providers: cnllProdivers.prestataires.map(cnllProviderToCMProdivers)
});
