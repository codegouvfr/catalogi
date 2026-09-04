// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { noUndefined } from "tsafe/noUndefined";
import { allEquals } from "evt/tools/reducers/allEquals";
import { exclude } from "tsafe/exclude";
import { removeDuplicatesFactory } from "evt/tools/reducers/removeDuplicates";
import { same } from "evt/tools/inDepth/same";
import { createResolveLocalizedString } from "i18nifty/LocalizedString/reactless";
import { id } from "tsafe/id";
import { languages, type Language, type LocalizedString } from "../../ports/GetSoftwareExternalData";
import type { GetSoftwareExternal } from "../../ports/GetSoftwareExternal";
import type { SoftwareExternal } from "../../types/SoftwareTypes";
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
import { makeWikidataAPIAgent } from "./ApiAgent";
import { WikidataFetchError } from "./ApiAgent/entity";
import { toCommonsSpecialFilePathUrl } from "./commonsImage";

const { resolveLocalizedString } = createResolveLocalizedString({
    "currentLanguage": id<Language>("en"),
    "fallbackLanguage": "en"
});

const publicationDateQualifier = "P577";

type WikidataVersionClaim = WikidataEntity["claims"][string][number];

const getVersionString = (claim: WikidataVersionClaim): string | undefined => {
    const value = claim.mainsnak.datavalue?.value;

    return typeof value === "string" ? value : undefined;
};

const getPublicationDate = (claim: WikidataVersionClaim): Date | undefined => {
    const value = claim.qualifiers?.[publicationDateQualifier]?.[0].datavalue.value as WikidataTime | undefined;

    return value?.time ? wikidataTimeToJSDate(value) : undefined;
};

const compareVersion = (version1: string[], version2: string[]): boolean => {
    if (version1.length === 0) return false;

    const version1Part = Number(version1[0]?.match(/\d+/)?.[0] ?? 0);
    const version2Part = Number(version2[0]?.match(/\d+/)?.[0] ?? 0);

    if (version1Part === version2Part) {
        return compareVersion(version1.slice(1), version2.slice(1));
    }

    return version1Part > version2Part;
};

export const latestVersionClaim = (ent: WikidataEntity): WikidataVersionClaim | undefined =>
    ent.claims.P348?.reduce<WikidataVersionClaim | undefined>((acc, statementClaim) => {
        const versionString = getVersionString(statementClaim);

        if (statementClaim.rank === "deprecated" || versionString === undefined) return acc;
        if (acc === undefined) return statementClaim;
        if (statementClaim.rank === "preferred" && acc.rank !== "preferred") return statementClaim;
        if (statementClaim.rank !== "preferred" && acc.rank === "preferred") return acc;

        const publicationTime = getPublicationDate(statementClaim)?.getTime();
        const previousPublicationTime = getPublicationDate(acc)?.getTime();

        if (
            publicationTime !== undefined &&
            previousPublicationTime !== undefined &&
            publicationTime !== previousPublicationTime
        ) {
            return publicationTime > previousPublicationTime ? statementClaim : acc;
        }

        const previousVersionString = getVersionString(acc);

        if (previousVersionString === undefined) return statementClaim;

        return compareVersion(versionString.split("."), previousVersionString.split(".")) ? statementClaim : acc;
    }, undefined);

export const getWikidataSoftware: GetSoftwareExternal = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareExternal | undefined> => {
        console.info(`   -> fetching wiki soft : ${source.slug}`);
        const wikidataAgent = makeWikidataAPIAgent(source);

        const { entity } =
            (await wikidataAgent.fetchEntity(externalId).catch(error => {
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

        // License (P275) and programming-language (P277) are only ever read for
        // their English alias. Fetch both in a single wbgetentities call with
        // `props=aliases` — one round-trip and a few KB instead of two
        // round-trips and a few hundred KB.
        const licenseId = getClaimDataValue<"wikibase-entityid">("P275")[0]?.id;
        const programmingLanguageId = getClaimDataValue<"wikibase-entityid">("P277")[0]?.id;

        const aliasesEnByEntityId = await wikidataAgent.fetchEntityAliasesEn(
            [licenseId, programmingLanguageId].filter((id): id is string => id !== undefined)
        );

        const license =
            licenseId !== undefined ? { label: aliasesEnByEntityId[licenseId]?.aliasEn, id: licenseId } : undefined;

        // Match the legacy resolver: prefer en, then fr, then `mul`.
        const plEntry = programmingLanguageId !== undefined ? aliasesEnByEntityId[programmingLanguageId] : undefined;
        const programmingLanguageString = plEntry?.labelEn ?? plEntry?.labelFr ?? plEntry?.labelMul;

        const versionClaim = latestVersionClaim(entity);
        const publicationTimeDate = versionClaim === undefined ? undefined : getPublicationDate(versionClaim);

        const framaLibreId = getClaimDataValue<"string">("P4107")[0];

        const sourceUrl = getClaimDataValue<"string">("P1324")[0];

        const nowIso = new Date().toISOString();
        const publicationIso = publicationTimeDate?.toISOString();

        return {
            variant: "external",
            id: undefined,
            externalId,
            sourceSlug: source.slug,
            "name": wikidataSingleLocalizedStringToLocalizedString(entity.labels) ?? {
                "en": "No label"
            },
            "description": wikidataSingleLocalizedStringToLocalizedString(entity.descriptions) ?? {
                "en": "No description"
            },
            "image": (() => {
                const value = getClaimDataValue<"string">("P154")[0];
                // Wikimedia blocks cross-origin hotlinks to direct
                // `upload.wikimedia.org/.../thumb/...` URLs (the shape produced
                // by scraping the rendered wikidata HTML page). Special:FilePath
                // is their supported redirector: it 302s to a current valid
                // thumbnail and the browser follows transparently.
                return toCommonsSpecialFilePathUrl(value);
            })(),
            ...(() => {
                const websiteUrl = getClaimDataValue<"string">("P856")[0];

                return {
                    codeRepositoryUrl: sourceUrl,
                    "url": sourceUrl !== websiteUrl ? websiteUrl : undefined
                };
            })(),
            "softwareHelp": getClaimDataValue<"string">("P2078")[0],
            "license": license?.label,
            "isLibreSoftware": license === undefined ? false : freeSoftwareLicensesWikidataIds.includes(license.id),
            "authors": await Promise.all(
                [
                    ...getClaimDataValue<"wikibase-entityid">("P50"),
                    ...getClaimDataValue<"wikibase-entityid">("P170"),
                    ...getClaimDataValue<"wikibase-entityid">("P172"),
                    ...getClaimDataValue<"wikibase-entityid">("P178")
                ].map(async ({ id }): Promise<SchemaPerson | SchemaOrganization | undefined> => {
                    console.info(`   -> fetching wiki dev : ${id}`);
                    const { entity } = await wikidataAgent.fetchEntity(id).catch(() => ({ "entity": undefined }));
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

                        return removeDuplicates<SoftwareExternal["authors"][number]>();
                    })()
                )
            ),
            latestVersion: versionClaim?.mainsnak?.datavalue?.value
                ? { version: versionClaim.mainsnak.datavalue.value as string, releaseDate: publicationIso }
                : undefined,
            dateCreated: publicationIso,
            addedTime: nowIso,
            updateTime: nowIso,
            keywords: getClaimDataValue<"string">("P921"),
            programmingLanguages: programmingLanguageString ? [programmingLanguageString] : [],
            applicationCategories: [],
            operatingSystems: { windows: false, linux: false, mac: false, android: false, ios: false },
            runtimePlatforms: [],
            referencePublications: [],
            identifiers: [
                ...(framaLibreId
                    ? [identifersUtils.makeFramaIndentifier({ framaLibreId, additionalType: "Software" })]
                    : []),
                identifersUtils.makeWikidataIdentifier({ wikidataId: externalId, additionalType: "Software" })
            ],
            providers: [],
            similarSoftwares: [],
            dereferencing: undefined,
            customAttributes: undefined,
            userAndReferentCountByOrganization: undefined,
            hasExpertReferent: undefined,
            instances: undefined
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
    // Apache-2.0 — Apache License 2.0
    "Q13785927",

    // BSD-2-Clause — BSD 2-Clause "Simplified" License
    "Q18517294",

    // BSD-3-Clause — BSD 3-Clause "New" or "Revised" License
    "Q18491847",

    // EPL-2.0 — Eclipse Public License 2.0
    "Q55633295",

    // EUPL-1.2 — European Union Public License 1.2
    "Q123162019",

    // AGPL-3.0-only — GNU Affero General Public License v3.0 only
    "Q136759706",

    // AGPL-3.0-or-later — GNU Affero General Public License v3.0 or later
    "Q27020062",

    // GPL-3.0-or-later — GNU General Public License v3.0 or later
    "Q27016754",

    // LGPL-3.0-or-later — GNU Lesser General Public License v3.0 or later
    "Q27016762",

    // MIT — MIT License
    "Q334661",

    // MPL-2.0 — Mozilla Public License 2.0
    "Q25428413",

    // CECILL-C — CeCILL-C Free Software License Agreement
    "Q125359628",

    // CECILL-2.1 — CeCILL Free Software License Agreement v2.1
    "Q1052189",

    // AFL-3.0 — Academic Free License v3.0
    "Q108111552",

    // Apache-1.1 — Apache License 1.1
    "Q17817999",

    // APSL-2.0 — Apple Public Source License 2.0
    "Q621330",

    // Artistic-2.0 — Artistic License 2.0
    "Q14624826",

    // BSL-1.0 — Boost Software License 1.0
    "Q2353141",

    // CDDL-1.0 — Common Development and Distribution License 1.0
    "Q26996811",

    // CPAL-1.0 — Common Public Attribution License 1.0
    "Q1116195",

    // CPL-1.0 — Common Public License 1.0
    "Q2477807",

    // EUDatagrid — EU DataGrid Software License
    "Q38365944",

    // EPL-1.0 — Eclipse Public License 1.0
    "Q55633170",

    // ECL-2.0 — Educational Community License v2.0
    "Q5341236",

    // EFL-2.0 — Eiffel Forum License v2.0
    "Q17011832",

    // EUPL-1.1 — European Union Public License 1.1
    "Q1376919",

    // GPL-2.0-only — GNU General Public License v2.0 only
    "Q10513450",

    // GPL-2.0-or-later — GNU General Public License v2.0 or later
    "Q27016752",

    // GPL-3.0-only — GNU General Public License v3.0 only
    "Q10513445",

    // LGPL-2.1-only — GNU Lesser General Public License v2.1 only
    "Q18534390",

    // LGPL-2.1-or-later — GNU Lesser General Public License v2.1 or later
    "Q27016757",

    // LGPL-3.0-only — GNU Lesser General Public License v3.0 only
    "Q18534393",

    // IPL-1.0 — IBM Public License v1.0
    "Q288745",

    // ISC — ISC License
    "Q386474",

    // Intel — Intel Open Source License
    "Q6043507",

    // MS-PL — Microsoft Public License
    "Q15477153",

    // MS-RL — Microsoft Reciprocal License
    "Q1772828",

    // MPL-1.1 — Mozilla Public License 1.1
    "Q26737735",

    // OSL-3.0 — Open Software License 3.0
    "Q777520",

    // Python-2.0 — Python License 2.0
    "Q5975028",

    // QPL-1.0 — Q Public License 1.0
    "Q1396282",

    // OFL-1.1 — SIL Open Font License 1.1
    "Q113507844",

    // SPL-1.0 — Sun Public License v1.0
    "Q648252",

    // Unlicense — The Unlicense
    "Q21659044",

    // UPL-1.0 — Universal Permissive License v1.0
    "Q38685700",

    // NCSA — University of Illinois/NCSA Open Source License
    "Q2495855",

    // Zlib — zlib License
    "Q207243",

    // ZPL-2.0 — Zope Public License 2.0
    "Q3780982",

    // BSD licenses (family; no SPDX id)
    "Q191307",
];
