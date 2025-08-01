// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import { GetSoftwareExternalData, SoftwareExternalData } from "../../ports/GetSoftwareExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { comptoirDuLibreApi } from "../comptoirDuLibreApi";
import { ComptoirDuLibre } from "../../ports/ComptoirDuLibreApi";
import { SchemaIdentifier, SchemaOrganization } from "../dbApi/kysely/kysely.database";
import { identifersUtils } from "../../../tools/identifiersTools";
import { repoUrlToIdentifer } from "../../../tools/repoAnalyser";

export const getCDLSoftwareExternalData: GetSoftwareExternalData = memoize(
    async ({
        externalId,
        source
    }: {
        externalId: string;
        source: Source;
    }): Promise<SoftwareExternalData | undefined> => {
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
): SoftwareExternalData => {
    const splittedCNLLUrl = !Array.isArray(cdlSoftwareItem.external_resources.cnll)
        ? cdlSoftwareItem.external_resources.cnll.url.split("/")
        : undefined;

    return {
        externalId: cdlSoftwareItem.id.toString(),
        sourceSlug: source.slug,
        developers: [],
        label: { "fr": cdlSoftwareItem.name },
        description: { "fr": "" },
        isLibreSoftware: true,
        //
        logoUrl: undefined, // Use scrapper ?
        websiteUrl: cdlSoftwareItem.external_resources.website ?? undefined,
        sourceUrl: cdlSoftwareItem.external_resources.repository ?? undefined,
        documentationUrl: undefined,
        license: cdlSoftwareItem.licence,
        softwareVersion: undefined,
        keywords: [],
        programmingLanguages: [],
        applicationCategories: [],
        publicationTime: undefined,
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
        repoMetadata: undefined,
        providers: cdlSoftwareItem.providers.map(cdlProviderToCMProdivers)
    };
};
