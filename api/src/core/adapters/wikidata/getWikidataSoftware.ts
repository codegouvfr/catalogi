// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { assert } from "tsafe/assert";
import memoize from "memoizee";
import { noUndefined } from "tsafe/noUndefined";
import { allEquals } from "evt/tools/reducers/allEquals";
import { exclude } from "tsafe/exclude";
import { removeDuplicatesFactory } from "evt/tools/reducers/removeDuplicates";
import { same } from "evt/tools/inDepth/same";
import { createResolveLocalizedString } from "i18nifty/LocalizedString/reactless";
import { id } from "tsafe/id";
import {
    languages,
    type Language,
    type GetSoftwareExternalData,
    type SoftwareExternalData,
    type LocalizedString
} from "../../ports/GetSoftwareExternalData";
import {
    type WikidataEntity,
    type DataValue,
    type LocalizedString as WikiDataLocalizedString,
    wikidataTimeToJSDate,
    WikidataTime
} from "../../../tools/WikidataEntity";
import { Source } from "../../usecases/readWriteSillData";
import { SchemaOrganization, SchemaPerson } from "../dbApi/kysely/kysely.database";
import { identifersUtils } from "../../../tools/identifiersTools";

const { resolveLocalizedString } = createResolveLocalizedString({
    "currentLanguage": id<Language>("en"),
    "fallbackLanguage": "en"
});

const compareVersion = (version1: string[], version2: string[]): boolean => {
    if (version1.length === 0) return false;

    if (Number(version1[0]) === Number(version2[0] ?? 0)) {
        return compareVersion(version1.slice(1), version2.slice(1));
    }

    return Number(version1[0]) > Number(version2[0]);
};

const lastestVersionClaim = (ent: WikidataEntity) => {
    return ent?.claims?.P348?.reduce((acc, statementClaim) => {
        const versionString = statementClaim.mainsnak.datavalue?.value;
        const oldversionString = acc.mainsnak.datavalue.value;

        if (!versionString) return acc;
        if (typeof versionString === "string" && typeof oldversionString === "string") {
            return compareVersion(versionString.split("."), oldversionString.split(".")) ? statementClaim : acc;
        } else {
            throw TypeError("Type not supported");
        }
    });
};

export const getWikidataSoftware: GetSoftwareExternalData = memoize(
    async ({
        externalId,
        source
    }: {
        externalId: string;
        source: Source;
    }): Promise<SoftwareExternalData | undefined> => {
        console.info(`   -> fetching wiki soft : ${source.slug}`);
        const { entity } =
            (await fetchEntity(externalId).catch(error => {
                if (error instanceof WikidataFetchError) {
                    if (error.status === 404 || error.status === undefined) {
                        return undefined;
                    }
                    throw error;
                }
            })) ?? {};

        if (entity === undefined) {
            return undefined;
        }

        const { getClaimDataValue } = createGetClaimDataValue({ entity });

        const license = await (async () => {
            const licenseId = getClaimDataValue<"wikibase-entityid">("P275")[0]?.id;

            if (licenseId === undefined) {
                return undefined;
            }

            console.info(`   -> fetching wiki license : ${licenseId}`);
            const { entity } = await fetchEntity(licenseId).catch(() => ({ "entity": undefined }));

            if (entity === undefined) {
                return undefined;
            }

            return { "label": entity.aliases.en?.[0]?.value, "id": licenseId };
        })();

        const { entity: programmingLanguageEntity } = await fetchEntity(
            getClaimDataValue<"wikibase-entityid">("P277")[0]?.id
        ).catch(() => ({ "entity": undefined }));
        const programmingLanguageLabel = programmingLanguageEntity
            ? wikidataSingleLocalizedStringToLocalizedString(programmingLanguageEntity.labels)
            : undefined;
        const programmingLanguageString = programmingLanguageLabel
            ? resolveLocalizedString(programmingLanguageLabel)
            : undefined;

        const versionClaim = lastestVersionClaim(entity);

        const publicationDateQualifier = "P577";
        const publicationTimeDateValue = versionClaim?.qualifiers?.[publicationDateQualifier]?.[0].datavalue.value as
            | WikidataTime
            | undefined;
        const publicationTimeDate = publicationTimeDateValue?.time
            ? wikidataTimeToJSDate(publicationTimeDateValue)
            : undefined;

        const framaLibreId = getClaimDataValue<"string">("P4107")[0];

        return {
            externalId,
            sourceSlug: source.slug,
            "label": wikidataSingleLocalizedStringToLocalizedString(entity.labels) ?? {
                "en": "No label"
            },
            "description": wikidataSingleLocalizedStringToLocalizedString(entity.descriptions) ?? {
                "en": "No description"
            },
            "logoUrl": await (async () => {
                const value = getClaimDataValue<"string">("P154")[0];

                if (value === undefined) {
                    return undefined;
                }

                const previewUrl = encodeURI(`${source.url}/wiki/${externalId}#/media/File:${value}`);

                const raw = await (async function callee(): Promise<string | undefined> {
                    const res = await fetch(previewUrl).catch(() => undefined);

                    if (res === undefined) {
                        return undefined;
                    }

                    // Too many requests
                    if (res.status === 429) {
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        return callee();
                    }

                    if (res.status !== 200) {
                        console.error(`Request to ${previewUrl} failed with error code ${res.status}`);
                        return undefined;
                    }

                    const raw = await res.text().catch(() => undefined);

                    if (raw === undefined) {
                        return undefined;
                    }

                    return raw;
                })();

                if (raw === undefined) {
                    return undefined;
                }

                const $ = cheerio.load(raw);

                const endOfHref =
                    "File:" +
                    encodeURIComponent(value)
                        .replace(/%2C/g, ",") //Preserve ','
                        .replace(/%20/g, "_") //Replace ' ' by '_'
                        .replace(/'/g, "%27"); //Replace ''' by '%27'

                const url = $(`a[href$="${endOfHref}"] img`).attr("src");

                assert(
                    url !== undefined,
                    `Wikidata scrapper needs to be updated ${previewUrl} ${value}, endOfHref: ${endOfHref}`
                );

                return url;
            })(),
            ...(() => {
                const websiteUrl = getClaimDataValue<"string">("P856")[0];
                const sourceUrl = getClaimDataValue<"string">("P1324")[0];

                return {
                    sourceUrl,
                    "websiteUrl": sourceUrl !== websiteUrl ? websiteUrl : undefined
                };
            })(),
            "documentationUrl": getClaimDataValue<"string">("P2078")[0],
            "license": license?.label,
            "isLibreSoftware": license === undefined ? false : freeSoftwareLicensesWikidataIds.includes(license.id),
            "developers": await Promise.all(
                [
                    ...getClaimDataValue<"wikibase-entityid">("P50"),
                    ...getClaimDataValue<"wikibase-entityid">("P170"),
                    ...getClaimDataValue<"wikibase-entityid">("P172"),
                    ...getClaimDataValue<"wikibase-entityid">("P178")
                ].map(async ({ id }): Promise<SchemaPerson | SchemaOrganization | undefined> => {
                    console.info(`   -> fetching wiki dev : ${id}`);
                    const { entity } = await fetchEntity(id).catch(() => ({ "entity": undefined }));
                    if (entity === undefined) {
                        return undefined;
                    }

                    const { getClaimDataValue } = createGetClaimDataValue({
                        entity
                    });

                    const name = (() => {
                        const { shortName } = (() => {
                            const shortName = getClaimDataValue<"text-language">("P1813")[0]?.text;

                            return { shortName };
                        })();

                        if (shortName !== undefined) {
                            return shortName;
                        }

                        const label = wikidataSingleLocalizedStringToLocalizedString(entity.labels);

                        if (label === undefined) {
                            return undefined;
                        }

                        return resolveLocalizedString(label);
                    })();

                    if (name === undefined) {
                        return undefined;
                    }

                    if (getClaimDataValue<"wikibase-entityid">("P31")[0]?.id === "Q5") {
                        return {
                            "@type": "Person",
                            name,
                            identifiers: [
                                identifersUtils.makeWikidataIdentifier({
                                    wikidataId: entity.id,
                                    additionalType: "Person"
                                })
                            ],
                            url: `https://www.wikidata.org/wiki/${entity.id}`
                        };
                    }

                    return {
                        "@type": "Organization",
                        name,
                        identifiers: [
                            identifersUtils.makeWikidataIdentifier({
                                wikidataId: entity.id,
                                additionalType: "Organization"
                            })
                        ],
                        url: `https://www.wikidata.org/wiki/${entity.id}`
                    };
                })
            ).then(developers =>
                developers.filter(exclude(undefined)).reduce(
                    ...(() => {
                        const { removeDuplicates } = removeDuplicatesFactory({
                            "areEquals": same
                        });

                        return removeDuplicates<SoftwareExternalData["developers"][number]>();
                    })()
                )
            ),
            softwareVersion: versionClaim?.mainsnak?.datavalue?.value as string | undefined,
            keywords: getClaimDataValue<"string">("P921"),
            programmingLanguages: programmingLanguageString ? [programmingLanguageString] : [],
            applicationCategories: undefined, // doesn't exit on wiki data
            referencePublications: undefined, // doesn't exit on wiki data
            publicationTime: publicationTimeDate,
            identifiers: [
                ...(framaLibreId
                    ? [identifersUtils.makeFramaIndentifier({ framaLibreId, additionalType: "Software" })]
                    : []),
                identifersUtils.makeWikidataIdentifier({ wikidataId: externalId, additionalType: "Software" })
            ],
            repoMetadata: undefined,
            providers: []
        };
    },
    {
        "promise": true,
        "maxAge": 3 * 3600 * 1000
    }
);

function wikidataSingleLocalizedStringToLocalizedString(
    wikidataSingleLocalizedString: WikiDataLocalizedString.Single
): LocalizedString | undefined {
    const localizedString = noUndefined(
        Object.fromEntries(languages.map(language => [language, wikidataSingleLocalizedString[language]?.value]))
    );

    const wikidataLocals = Object.keys(localizedString);

    if (wikidataLocals.length === 0) {
        const fallbackLocalForAllLanguage = "mul"; // used by wikidata
        const firstLocalInList = Object.keys(wikidataSingleLocalizedString)[0];
        return (
            wikidataSingleLocalizedString[fallbackLocalForAllLanguage]?.value ??
            wikidataSingleLocalizedString[firstLocalInList]?.value
        );
    }

    if (Object.values(localizedString).reduce(...allEquals())) {
        return localizedString[wikidataLocals[0]];
    }

    return localizedString;
}

export class WikidataFetchError extends Error {
    constructor(public readonly status: number | undefined) {
        super(`Wikidata fetch error status: ${status}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export async function fetchEntity(wikidataId: string): Promise<{ entity: WikidataEntity }> {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`).catch(
        () => undefined
    );

    if (res === undefined) {
        throw new WikidataFetchError(undefined);
    }

    if (res.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return fetchEntity(wikidataId);
    }

    if (res.status === 404) {
        throw new WikidataFetchError(res.status);
    }

    const json = await res.json();

    const entity = Object.values(json["entities"])[0] as WikidataEntity;

    console.info(`   -> fetched wiki soft : ${entity.aliases.en?.[0]?.value || entity.aliases.fr?.[0]?.value}`);

    return { entity };
}

export function createGetClaimDataValue(params: { entity: WikidataEntity }) {
    const { entity } = params;

    function getClaimDataValue<Type extends "string" | "wikibase-entityid" | "text-language" | "time">(
        property: `P${number}`
    ) {
        const statementClaim = entity.claims[property];

        if (statementClaim === undefined) {
            return [];
        }

        return statementClaim
            .filter(x => x.rank !== "deprecated")
            .sort((a, b) => {
                const getWeight = (rank: (typeof a)["rank"]) => (rank === "preferred" ? 1 : 0);
                return getWeight(b.rank) - getWeight(a.rank);
            })
            .filter(x => x.mainsnak.snaktype === "value")
            .map(x => (x.mainsnak.datavalue as DataValue<Type>).value);
    }

    return { getClaimDataValue };
}

// Array of Free Software Licenses and their corresponding Wikidata IDs
export const freeSoftwareLicensesWikidataIds = [
    // Apache License 2.0
    "Q309877",

    // BSD 2-Clause "Simplified" License
    "Q1507844",

    // BSD 3-Clause "New" or "Revised" License
    "Q1507824",

    // Eclipse Public License 2.0
    "Q5184255",

    // European Union Public License 1.2
    "Q65267454",

    // GNU Affero General Public License v3.0 only
    "Q1277061",

    // GNU Affero General Public License v3.0 or later
    "Q38926",

    // GNU General Public License v3.0 or later
    "Q2464622",

    // GNU Lesser General Public License v3.0 or later
    "Q39015",

    // MIT License
    "Q334661",

    // Mozilla Public License 2.0
    "Q334062",

    // CeCILL-B Free Software License Agreement
    "Q5099871",

    // CeCILL-C Free Software License Agreement
    "Q5099874",

    // CeCILL Free Software License Agreement v2.1
    "Q369616",

    // Academic Free License v3.0
    "Q467700",

    // Apache License 1.1
    "Q309884",

    // Apple Public Source License 2.0
    "Q466388",

    // Artistic License 2.0
    "Q6938433",

    // Boost Software License 1.0
    "Q333029",

    // Common Development and Distribution License 1.0
    "Q334209",

    // Common Public Attribution License 1.0
    "Q332884",

    // Common Public License 1.0
    "Q334393",

    // EU DataGrid Software License
    "Q5334061",

    // Eclipse Public License 1.0
    "Q334083",

    // Educational Community License v2.0
    "Q5358492",

    // Eiffel Forum License v2.0
    "Q465952",

    // European Union Public License 1.1
    "Q65267453",

    // GNU General Public License v2.0 only
    "Q7590",

    // GNU General Public License v2.0 or later
    "Q7553",

    // GNU General Public License v3.0 only
    "Q7571",

    // GNU Lesser General Public License v2.1 only
    "Q7547",

    // GNU Lesser General Public License v2.1 or later
    "Q30245",

    // GNU Lesser General Public License v3.0 only
    "Q7539",

    // GNU General Public License, version 3.0
    "Q10513445",

    // IBM Public License v1.0
    "Q467144",

    // ISC License
    "Q330779",

    // Intel Open Source License
    "Q607106",

    // Microsoft Public License
    "Q33057",

    // Microsoft Reciprocal License
    "Q33058",

    // Mozilla Public License 1.1
    "Q334395",

    // Open Software License 3.0
    "Q335473",

    // Python License 2.0
    "Q72189",

    // Q Public License 1.0
    "Q321678",

    // SIL Open Font License 1.1
    "Q55980",

    // Sun Public License v1.0
    "Q332889",

    // The Unlicense
    "Q6938435",

    // Universal Permissive License v1.0
    "Q107081891",

    // University of Illinois/NCSA Open Source License
    "Q667009",

    // Zlib License
    "Q207149",

    // Zope Public License 2.0
    "Q336266",

    // BSD licenses
    "Q191307"
];
