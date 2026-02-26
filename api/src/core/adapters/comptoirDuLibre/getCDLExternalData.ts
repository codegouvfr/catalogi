// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import type { GetSoftwareExternal } from "../../ports/GetSoftwareExternal";
import type { SoftwareExternal } from "../../types/SoftwareTypes";
import { Source } from "../../usecases/readWriteSillData";
import { comptoirDuLibreApi } from "../comptoirDuLibreApi";
import { ComptoirDuLibre } from "../../ports/ComptoirDuLibreApi";
import { SchemaIdentifier, SchemaOrganization } from "../dbApi/kysely/kysely.database";
import { identifersUtils } from "../../../tools/identifiersTools";
import { repoUrlToIdentifer } from "../../../tools/repoAnalyser";

export const getCDLSoftwareExternalData: GetSoftwareExternal = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareExternal | undefined> => {
        const comptoirAPi = await comptoirDuLibreApi.getComptoirDuLibre();

        const comptoirSoftware = comptoirAPi.softwares.find(softwareItem => softwareItem.id.toString() === externalId);

        if (!comptoirSoftware) return undefined;

        const repoIdentifier = await repoUrlToIdentifer({
            repoUrl: comptoirSoftware.external_resources.repository ?? undefined
        });

        return formatCDLSoftwareToExternalData(comptoirSoftware, source, repoIdentifier);
    },
    {
        maxAge: 3 * 3600 * 1000
    }
);

const cdlProviderToCMProdivers = (provider: ComptoirDuLibre.Provider): SchemaOrganization => {
    return {
        "@type": "Organization" as const,
        name: provider.name,
        url: provider.external_resources.website ?? undefined,
        identifiers: [
            identifersUtils.makeCDLIdentifier({
                cdlId: provider.id.toString(),
                url: provider.url,
                additionalType: "Organization"
            })
        ]
    };
};

const formatCDLSoftwareToExternalData = (
    cdlSoftwareItem: ComptoirDuLibre.Software,
    source: Source,
    repoIdentifier: SchemaIdentifier | undefined
): SoftwareExternal => {
    const splittedCNLLUrl = !Array.isArray(cdlSoftwareItem.external_resources.cnll)
        ? cdlSoftwareItem.external_resources.cnll.url.split("/")
        : undefined;
    const nowIso = new Date().toISOString();

    return {
        variant: "external",
        id: undefined,
        externalId: cdlSoftwareItem.id.toString(),
        sourceSlug: source.slug,
        authors: [],
        name: { "fr": cdlSoftwareItem.name },
        description: { "fr": "" },
        isLibreSoftware: true,
        image: undefined,
        url: cdlSoftwareItem.external_resources.website ?? undefined,
        codeRepositoryUrl: cdlSoftwareItem.external_resources.repository ?? undefined,
        softwareHelp: undefined,
        license: cdlSoftwareItem.licence,
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
            identifersUtils.makeCDLIdentifier({
                cdlId: cdlSoftwareItem.id.toString(),
                url: cdlSoftwareItem.url,
                additionalType: "Software"
            }),
            ...(!Array.isArray(cdlSoftwareItem.external_resources.cnll) && splittedCNLLUrl
                ? [
                      identifersUtils.makeCNLLIdentifier({
                          cNNLId: splittedCNLLUrl[splittedCNLLUrl.length - 1],
                          url: cdlSoftwareItem.external_resources.cnll.url
                      })
                  ]
                : []),
            ...(!Array.isArray(cdlSoftwareItem.external_resources.framalibre)
                ? [
                      identifersUtils.makeFramaIndentifier({
                          framaLibreId: cdlSoftwareItem.external_resources.framalibre.slug,
                          url: cdlSoftwareItem.external_resources.framalibre.url,
                          additionalType: "Software"
                      })
                  ]
                : []),
            ...(!Array.isArray(cdlSoftwareItem.external_resources.wikidata)
                ? [
                      identifersUtils.makeWikidataIdentifier({
                          wikidataId: cdlSoftwareItem.external_resources.wikidata.id,
                          url: cdlSoftwareItem.external_resources.wikidata.url,
                          additionalType: "Software"
                      })
                  ]
                : []),
            ...(repoIdentifier ? [repoIdentifier] : [])
        ],
        providers: cdlSoftwareItem.providers.map(cdlProviderToCMProdivers),
        sameAs: [],
        dereferencing: undefined,
        customAttributes: undefined,
        userAndReferentCountByOrganization: undefined,
        hasExpertReferent: undefined,
        instances: undefined
    };
};
