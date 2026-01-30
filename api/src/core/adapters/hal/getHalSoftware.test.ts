// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, it } from "vitest";
import { expectToEqual } from "../../../tools/test.helpers";
import { Source } from "../../usecases/readWriteSillData";
import { getHalSoftwareExternalData } from "./getHalSoftwareExternalData";
import { getHalSoftwareOptions } from "./getHalSoftwareOptions";

describe("HAL", () => {
    const halSource: Source = {
        slug: "hal-science",
        kind: "HAL",
        url: "https://hal.science",
        priority: 1,
        description: undefined
    };
    describe("getHalSoftwareExternalData", () => {
        it("gets data from Hal and converts it to ExternalSoftware", async () => {
            // https://api.archives-ouvertes.fr/search/?q=docid:1510897&wt=json&fl=*&sort=docid%20asc
            const result = await getHalSoftwareExternalData({
                externalId: "1715545",
                source: halSource
            });

            expectToEqual(result, {
                "description": { "en": "-", "fr": undefined },
                "developers": [
                    {
                        "@type": "Person",
                        "affiliations": [],
                        "identifiers": [
                            {
                                value: "0000-0002-9777-5560",
                                "@type": "PropertyValue",
                                "additionalType": "Person",
                                "subjectOf": {
                                    "@type": "Website",
                                    "additionalType": "ORCID",
                                    "name": "Open Researcher and Contributor ID",
                                    "url": new URL("https://orcid.org/")
                                },
                                "url": "https://orcid.org/0000-0002-9777-5560"
                            }
                        ],
                        "name": "Morane Gruenpeter"
                    }
                ],
                "documentationUrl": undefined,
                "externalId": "1715545",
                "isLibreSoftware": true,
                "label": {
                    "en": "Battleship exercise",
                    "fr": "Battleship exercise"
                },
                "license": "MIT License",
                "logoUrl": undefined,
                "sourceSlug": halSource.slug,
                "sourceUrl": "https://github.com/moranegg/Battleship",
                "websiteUrl": "https://inria.hal.science/hal-01715545v1",
                "softwareVersion": undefined,
                "keywords": undefined,
                "programmingLanguages": undefined,
                "applicationCategories": ["Computer Science [cs]"],
                "referencePublications": undefined,
                "repoMetadata": {},
                "identifiers": [
                    {
                        "@type": "PropertyValue",
                        "additionalType": "Software",
                        "subjectOf": {
                            "@type": "Website",
                            "additionalType": "HAL",
                            "name": "HAL main instance",
                            "url": new URL("https://hal.science/")
                        },
                        "url": "https://inria.hal.science/hal-01715545v1",
                        "value": "1715545"
                    },
                    {
                        "@type": "PropertyValue",
                        "additionalType": "Software",
                        "subjectOf": {
                            "@type": "Website",
                            "additionalType": "SWH",
                            "name": "Software Heritage instance",
                            "url": new URL("https://www.softwareheritage.org/")
                        },
                        "url": "https://archive.softwareheritage.org/swh:1:dir:424f2533fe51aa8a49d891f8413dd089995cc851;origin=https://hal.archives-ouvertes.fr/hal-01715545;visit=swh:1:snp:9f3237e88d818d975a63da2d5e04d9ad38b42581;anchor=swh:1:rev:8b71800feca2e28cc0f7f78d248e49244b554875;path=/",
                        "value":
                            "swh:1:dir:424f2533fe51aa8a49d891f8413dd089995cc851;origin=https://hal.archives-ouvertes.fr/hal-01715545;visit=swh:1:snp:9f3237e88d818d975a63da2d5e04d9ad38b42581;anchor=swh:1:rev:8b71800feca2e28cc0f7f78d248e49244b554875;path=/"
                    },
                    {
                        "@type": "PropertyValue",
                        "additionalType": "Repo",
                        "subjectOf": {
                            "@type": "Website",
                            "additionalType": "GitHub",
                            "name": "GitHub is a proprietary developer platform that allows developers to create, store, manage, and share their code.",
                            "url": new URL("https://github.com/")
                        },
                        "url": "https://github.com/moranegg/Battleship",
                        "value": "https://github.com/moranegg/Battleship",
                        "valueReference": "17635873"
                    }
                ],
                "publicationTime": new Date(1521545908000),
                "providers": []
            });
        });
    });

    describe("getHalSoftwareOption", () => {
        it("gets data from Hal and converts it to ExternalSoftwareOption, and returns the provided language", async () => {
            const enOptions = await getHalSoftwareOptions({
                queryString: "multisensi",
                language: "en",
                source: halSource
            });
            expectToEqual(enOptions, [
                {
                    externalId: "2801278",
                    label: "multisensi",
                    description: "Functions to perform sensitivity analysis on a model with multivariate output.",
                    isLibreSoftware: true,
                    sourceSlug: halSource.slug
                }
            ]);

            const frOptions = await getHalSoftwareOptions({
                queryString: "multisensi",
                language: "fr",
                source: halSource
            });
            expectToEqual(frOptions, [
                {
                    externalId: "2801278",
                    label: "multisensi : Analyse de sensibilité multivariée",
                    description: "Functions to perform sensitivity analysis on a model with multivariate output.",
                    isLibreSoftware: true,
                    sourceSlug: halSource.slug
                }
            ]);
        });
    });
});
