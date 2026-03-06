// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import type { GetSoftwareExternal } from "../../ports/GetSoftwareExternal";
import type { SoftwareExternal } from "../../types/SoftwareTypes";
import { Source } from "../../usecases/readWriteSillData";
import { SchemaIdentifier, SchemaPerson } from "../dbApi/kysely/kysely.database";
import { identifersUtils } from "../../../tools/identifiersTools";
import { makeZenodoApi } from "./zenodoAPI";
import { Zenodo } from "./zenodoAPI/type";
import { populateFromDOIIdentifiers } from "../doiResolver";
import { repoUrlToIdentifer } from "../../../tools/repoAnalyser";

export const getZenodoExternalData: GetSoftwareExternal = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareExternal | undefined> => {
        if (source.kind !== "Zenodo" && source.url !== "https://zenodo.org/")
            throw new Error(`Not a Zenodo source, was : ${source.kind}`);

        const zenodoApi = makeZenodoApi();

        let record: Zenodo.Record | undefined = undefined;

        if (externalId.includes("10.5281")) {
            record = await zenodoApi.records.getByDOI(externalId);
        } else {
            record = await zenodoApi.records.get(Number(externalId));
        }

        const communities = await zenodoApi.records.getCommunities(Number(externalId));
        const communitiesRows = communities?.hits?.hits ?? [];

        if (!record) return undefined;
        if (record.metadata.resource_type.type !== "software") {
            console.error(`The record corresponding at ${externalId} is not a software`);
            return undefined;
        }

        const repositoryUrl =
            record.metadata.related_identifiers?.filter(identifier => identifier.relation === "isSupplementTo")?.[0]
                ?.identifier ?? undefined;
        const repoIdentifer = await repoUrlToIdentifer({ repoUrl: repositoryUrl });

        const formatedExternalData = formatRecordToExternalData(record, communitiesRows, source, repoIdentifer);

        formatedExternalData.identifiers = await populateFromDOIIdentifiers(formatedExternalData.identifiers ?? []);

        return formatedExternalData;
    }
);

const creatorToPerson = (creator: Zenodo.Creator): SchemaPerson => {
    return {
        "@type": "Person" as const,
        name: creator.name,
        affiliations: creator.affiliation
            ? [
                  {
                      "@type": "Organization",
                      name: creator.affiliation
                  }
              ]
            : [],
        identifiers: [...(creator.orcid ? [identifersUtils.makeOrcidIdentifer({ orcidId: creator.orcid })] : [])]
    };
};

const formatRecordToExternalData = (
    recordSoftwareItem: Zenodo.Record,
    communities: Zenodo.Community[],
    source: Source,
    repoIdentifier: SchemaIdentifier | undefined
): SoftwareExternal => {
    const publicationIso = recordSoftwareItem.metadata.publication_date
        ? new Date(recordSoftwareItem.metadata.publication_date).toISOString()
        : undefined;
    const nowIso = new Date().toISOString();

    return {
        variant: "external",
        id: undefined,
        externalId: recordSoftwareItem.id.toString(),
        sourceSlug: source.slug,
        authors: recordSoftwareItem.metadata.creators.map(creatorToPerson),
        name: { "en": recordSoftwareItem.metadata.title },
        description: { "en": recordSoftwareItem.metadata.description },
        isLibreSoftware: recordSoftwareItem.metadata.access_right === "open",
        image: undefined,
        url: undefined,
        codeRepositoryUrl:
            recordSoftwareItem.metadata.related_identifiers?.filter(
                identifier => identifier.relation === "isSupplementTo"
            )?.[0]?.identifier ?? undefined,
        softwareHelp: undefined,
        license: recordSoftwareItem.metadata.license?.id ?? "Copyright",
        latestVersion: recordSoftwareItem.metadata.version
            ? { version: recordSoftwareItem.metadata.version, releaseDate: publicationIso }
            : undefined,
        dateCreated: publicationIso,
        addedTime: nowIso,
        updateTime: nowIso,
        keywords: recordSoftwareItem.metadata.keywords ?? [],
        programmingLanguages:
            recordSoftwareItem.metadata.custom?.["code:programmingLanguage"]?.map(item => item.title.en) ?? [],
        applicationCategories: communities?.map(commu => commu.metadata.title) ?? [],
        operatingSystems: { windows: false, linux: false, mac: false, android: false, ios: false },
        runtimePlatforms: [],
        referencePublications: [],
        identifiers: [
            identifersUtils.makeZenodoIdentifer({
                zenodoId: recordSoftwareItem.id.toString(),
                url: `htpps://zenodo.org/records/${recordSoftwareItem.id.toString()}`,
                additionalType: "Software"
            }),
            ...(recordSoftwareItem.metadata.doi
                ? [identifersUtils.makeDOIIdentifier({ doi: recordSoftwareItem.metadata.doi })]
                : []),
            ...(recordSoftwareItem.swh.swhid
                ? [identifersUtils.makeSWHIdentifier({ swhId: recordSoftwareItem.swh.swhid })]
                : []),
            ...(repoIdentifier ? [repoIdentifier] : [])
        ],
        providers: [],
        similarSoftwares: [],
        dereferencing: undefined,
        customAttributes: undefined,
        userAndReferentCountByOrganization: undefined,
        hasExpertReferent: undefined,
        instances: undefined
    };
};
