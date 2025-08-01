// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { JSDOM } from "jsdom";
import { GetSoftwareExternalData, SoftwareExternalData } from "../../ports/GetSoftwareExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { halAPIGateway } from "./HalAPI";
import { HAL } from "./HalAPI/types/HAL";
import { crossRefSource } from "./CrossRef";
import { getScholarlyArticle } from "./getScholarlyArticle";
import { SchemaIdentifier, SchemaOrganization, SchemaPerson, ScholarlyArticle } from "../dbApi/kysely/kysely.database";
import { identifersUtils } from "../../../tools/identifiersTools";
import { populateFromDOIIdentifiers } from "../doiResolver";
import { repoUrlToIdentifer } from "../../../tools/repoAnalyser";

const buildParentOrganizationTree = async (
    structureIdArray: number[] | string[] | undefined
): Promise<SchemaOrganization[]> => {
    if (!structureIdArray) return [];

    const IdsArray = structureIdArray.map(id => Number(id));

    return await Promise.all(
        IdsArray.map(async (structureId: number) => {
            const structure = await halAPIGateway.structure.getById(structureId);

            if (!structure) throw new Error(`Couldn't get data for structure docid : ${structureId}`);

            return {
                "@type": "Organization",
                "name": structure.name_s,
                "url": structure.ror_s?.[0] ?? structure.ror_s ?? structure?.url_s,
                "parentOrganizations": await buildParentOrganizationTree(structure?.parentDocid_i)
            };
        })
    );
};

const buildReferencePublication = async (
    source: HAL.ArticleIdentifierOrigin,
    valueId: string
): Promise<ScholarlyArticle | undefined> => {
    switch (source) {
        case "hal":
            return getScholarlyArticle(valueId);

        case "doi":
            return crossRefSource.scholarlyArticle.getById(valueId);

        default:
            source satisfies never;
            throw Error();
    }
};

const parseScolarId = (scholarId: string): HAL.ArticleIdentifierOrigin => {
    if (scholarId.startsWith("10.")) return "doi";

    return "hal";
};

const resolveStructId = (parsedXMLLabel: JSDOM, structAcronym: string) => {
    const orgs = parsedXMLLabel.window.document.getElementsByTagName("org");

    const org = Array.from(orgs).filter((org: Element) => {
        const orgNames = org.getElementsByTagName("orgName");
        const acronymNode = Array.from(orgNames).filter((node: Element) => {
            return node.getAttribute("type") === "acronym";
        });

        return acronymNode[0]?.textContent === structAcronym;
    });

    return Number(org[0].getAttribute("xml:id")?.split("-")[1]);
};

export const getHalSoftwareExternalData: GetSoftwareExternalData = memoize(
    async ({
        externalId,
        source
    }: {
        externalId: string;
        source: Source;
    }): Promise<SoftwareExternalData | undefined> => {
        const halRawSoftware = await halAPIGateway.software.getById(externalId).catch(error => {
            if (!(error instanceof HAL.API.FetchError)) throw error;
            if (error.status === 404 || error.status === undefined) return;
            throw error;
        });

        if (halRawSoftware === undefined) return;
        if (halRawSoftware.docType_s !== "SOFTWARE") return;

        const sciencesCategories = await Promise.all(
            halRawSoftware.domainAllCode_s.map(async (code: string): Promise<string> => {
                const domain = await halAPIGateway.domain.getByCode(code);
                return domain.en_domain_s;
            })
        );

        const codemetaSoftware = await halAPIGateway.software.getCodemetaByUrl(halRawSoftware.uri_s);
        if (!codemetaSoftware) {
            throw Error(`No codemeta found for doc : ${externalId} - (source: ${source.slug})`);
        }

        const labelXmlDoc = new JSDOM(halRawSoftware.label_xml, { contentType: "application/xml" });

        const authors = await Promise.all(
            codemetaSoftware.author.map(async role => {
                const author = role.author;
                const id = author?.["@id"]?.[0];
                const affiliation = author.affiliation;

                const base: SchemaPerson = {
                    "@type": "Person",
                    name: `${author.givenName} ${author.familyName}`,
                    affiliations: [] as SchemaOrganization[]
                };

                if (affiliation?.length && affiliation.length > 0) {
                    const structures = await Promise.all(
                        affiliation
                            .filter(affilatiedStructure => affilatiedStructure.name)
                            .map(async affilatiedStructure => {
                                const structure = await halAPIGateway.structure.getById(
                                    resolveStructId(labelXmlDoc, affilatiedStructure?.name)
                                );

                                if (!structure) {
                                    throw new Error(`Structure not found : name = ${affilatiedStructure?.name}`);
                                }
                                return {
                                    "@type": "Organization" as const,
                                    "name": structure.name_s,
                                    "url": structure.ror_s?.[0] ?? structure.ror_s ?? structure?.url_s,
                                    "parentOrganizations": await buildParentOrganizationTree(structure.parentDocid_i)
                                };
                            })
                    );
                    base.affiliations = structures;
                }

                if (id?.split("-")?.length === 4 && id?.length === 19) {
                    return {
                        ...base,
                        identifiers: [identifersUtils.makeOrcidIdentifer({ orcidId: id, additionalType: "Person" })]
                    };
                }

                let sourceBase = new URL(source.url);

                if (id) {
                    sourceBase.pathname = `search/index/q/*/authIdHal_s/${id}`;
                } else {
                    sourceBase.pathname = `search/index/q/*/authFullName_s/${author.givenName}+${author.familyName}`;
                }

                return {
                    ...base,
                    identifiers: [
                        identifersUtils.makeHALIdentifier({
                            halId: id ?? "",
                            additionalType: "Person",
                            url: sourceBase.toString()
                        })
                    ]
                };
            })
        );

        const repoIdentifier = await repoUrlToIdentifer({ repoUrl: halRawSoftware?.softCodeRepository_s?.[0] });

        const identifiers: SchemaIdentifier[] = [
            ...codemetaSoftware?.identifier?.map(identifierItem => {
                const base = {
                    "@type": "PropertyValue" as const,
                    value: identifierItem.value,
                    url: new URL(identifierItem.propertyID)
                };
                switch (identifierItem["@type"]) {
                    case "hal":
                        return identifersUtils.makeHALIdentifier({
                            halId: halRawSoftware.docid,
                            additionalType: "Software",
                            url: halRawSoftware.uri_s
                        });
                    case "swhid":
                        return identifersUtils.makeSWHIdentifier({
                            swhId: identifierItem.value,
                            additionalType: "Software",
                            url: identifierItem.propertyID
                        });
                    case "doi":
                        return identifersUtils.makeDOIIdentifier({
                            doi: identifierItem.value,
                            additionalType: "Software"
                        });
                    case "bibcode":
                    case "cern":
                    case "prodinra":
                    case "arxiv":
                    case "biorxiv":
                    default:
                        return base;
                }
            }) ?? [],
            ...(repoIdentifier ? [repoIdentifier] : [])
        ]


        return {
            externalId: halRawSoftware.docid,
            sourceSlug: source.slug,
            developers: authors ?? [],
            label: {
                "en": halRawSoftware?.en_title_s?.[0] ?? halRawSoftware?.title_s?.[0] ?? "-",
                "fr": halRawSoftware?.fr_title_s?.[0] ?? halRawSoftware.en_title_s?.[0] // TODO pourquoi en anglais et pas défault ?
            },
            description: {
                "en": halRawSoftware?.en_abstract_s?.[0] ?? halRawSoftware.abstract_s?.[0] ?? "-",
                "fr": halRawSoftware?.fr_abstract_s?.[0] ?? halRawSoftware.en_abstract_s?.[0] // TODO pourquoi en anglais et pas défault ?
            },
            isLibreSoftware: halRawSoftware.openAccess_bool,
            // Optionnal
            logoUrl: undefined,
            websiteUrl: halRawSoftware.uri_s,
            sourceUrl: halRawSoftware?.softCodeRepository_s?.[0],
            documentationUrl: undefined, // TODO no info about documentation in HAL check on SWH or Repo ?
            license: codemetaSoftware?.license?.[0] ?? "undefined",
            softwareVersion: halRawSoftware?.softVersion_s?.[0],
            keywords: halRawSoftware?.keyword_s,
            programmingLanguages: halRawSoftware?.softProgrammingLanguage_s,
            applicationCategories: sciencesCategories,
            publicationTime: halRawSoftware?.releasedDate_tdate
                ? new Date(halRawSoftware?.releasedDate_tdate)
                : undefined,
            referencePublications:
                halRawSoftware.relatedPublication_s &&
                (
                    await Promise.all(
                        halRawSoftware.relatedPublication_s.map(id => buildReferencePublication(parseScolarId(id), id))
                    )
                ).filter(val => val !== undefined),
            identifiers: [
                ... await populateFromDOIIdentifiers(identifiers)],
            providers: [],
            repoMetadata: undefined
        };
    },
    {
        "promise": true,
        "maxAge": 3 * 3600 * 1000
    }
);
