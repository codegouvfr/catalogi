// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import type { GetSoftwareExternal } from "../../ports/GetSoftwareExternal";
import type { SoftwareExternal } from "../../types/SoftwareTypes";
import { Source } from "../../usecases/readWriteSillData";
import { SchemaOrganization } from "../dbApi/kysely/kysely.database";
import { identifersUtils } from "../../../tools/identifiersTools";
import { getCnllPrestatairesSill } from "../getCnllPrestatairesSill";
import { CnllPrestatairesSill } from "../../ports/GetCnllPrestatairesSill";

export const getCNLLSoftwareExternalData: GetSoftwareExternal = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareExternal | undefined> => {
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

const formatCNLLProvidersToExternalData = (cnllProdivers: CnllPrestatairesSill, source: Source): SoftwareExternal => {
    const nowIso = new Date().toISOString();

    return {
        variant: "external",
        id: undefined,
        externalId: cnllProdivers.sill_id.toString(),
        sourceSlug: source.slug,
        authors: [],
        name: { "fr": cnllProdivers.nom },
        description: { "fr": "" },
        isLibreSoftware: true,
        image: undefined,
        url: undefined,
        codeRepositoryUrl: undefined,
        softwareHelp: undefined,
        license: undefined,
        latestVersion: undefined,
        dateCreated: undefined,
        addedTime: nowIso,
        updateTime: nowIso,
        keywords: [],
        programmingLanguages: [],
        applicationCategories: [],
        operatingSystems: { windows: false, linux: false, mac: false, android: false, ios: false },
        runtimePlatforms: [],
        referencePublications: [],
        identifiers: [
            identifersUtils.makeCNLLIdentifier({
                cNNLId: cnllProdivers.sill_id.toString()
            })
        ],
        providers: cnllProdivers.prestataires.map(cnllProviderToCMProdivers),
        sameAs: [],
        dereferencing: undefined,
        customAttributes: undefined,
        userAndReferentCountByOrganization: undefined,
        hasExpertReferent: undefined,
        instances: undefined
    };
};
