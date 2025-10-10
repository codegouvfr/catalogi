// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeAll } from "vitest";
import { zenodoSourceGateway } from "./index";
import { Source } from "../../usecases/readWriteSillData";

const admtoolsSoftware = {
    externalId: "15479049",
    sourceSlug: "zenodo",
    developers: [
        {
            "@type": "Person",
            name: "Hohmann, Niklas",
            affiliations: [
                {
                    "@type": "Organization",
                    name: "Utrecht University"
                }
            ],
            identifiers: [
                {
                    "@type": "PropertyValue",
                    value: "0000-0003-1559-1838",
                    url: "https://orcid.org/0000-0003-1559-1838",
                    subjectOf: {
                        "@type": "Website",
                        name: "Open Researcher and Contributor ID",
                        url: new URL("https://orcid.org/"),
                        additionalType: "ORCID"
                    }
                }
            ]
        }
    ],
    label: {
        en: "admtools"
    },
    description: {
        en: "R package to estimate age-depth models and transform data between the time domain and the stratigraphic domain."
    },
    isLibreSoftware: true,
    logoUrl: undefined,
    websiteUrl: undefined,
    sourceUrl: "https://github.com/MindTheGap-ERC/admtools/tree/v0.6.0",
    documentationUrl: undefined,
    license: "gpl-3.0",
    softwareVersion: "v0.6.0",
    keywords: ["Geochronology", "Age-depth modeling", "Stratigraphy", "Sedimentology"],
    programmingLanguages: undefined,
    applicationCategories: [
        "Quantifying the completeness of the stratigraphic record and its role in reconstructing the tempo and mode of evolution",
        "EU Open Research Repository"
    ],
    publicationTime: "2025-05-21",
    referencePublications: [],
    identifiers: [
        {
            "@type": "PropertyValue",
            value: "15479049",
            url: "htpps://zenodo.org/records/15479049",
            subjectOf: {
                "@type": "Website",
                name: "Zenodo",
                url: new URL("https://zenodo.org/"),
                additionalType: "Zenodo"
            },
            additionalType: "Software"
        },
        {
            "@type": "PropertyValue",
            name: "DOI id",
            url: new URL("https://doi.org/10.5281/zenodo.15479049"),
            value: "10.5281/zenodo.15479049",
            subjectOf: {
                "@type": "Website",
                name: "DOI instance",
                url: new URL("https://doi.org/"),
                additionalType: "doi"
            }
        },
        {
            "@type": "PropertyValue",
            value: "swh:1:dir:8cec52058a668952ac710eff0c9987f550e4404d;origin=https://doi.org/10.5281/zenodo.10213587;visit=swh:1:snp:11cd97b84512b417ce6ecc6b1eae3d358d918bbb;anchor=swh:1:rel:27ef645123e587f8126f6cf814ef5c0ae537500a;path=MindTheGap-ERC-admtools-be5d1ac",
            url: undefined,
            subjectOf: {
                "@type": "Website",
                name: "Software Heritage instance",
                url: new URL("https://www.softwareheritage.org/"),
                additionalType: "SWH"
            }
        }
    ],
    providers: []
};

const amdSoftwareForm = {
    softwareName: "admtools",
    softwareDescription:
        "R package to estimate age-depth models and transform data between the time domain and the stratigraphic domain.",
    softwareType: {
        type: "desktop/mobile",
        os: {
            linux: false,
            windows: false,
            android: false,
            ios: false,
            mac: false
        }
    },
    externalIdForSource: "15479049",
    sourceSlug: "zenodo",
    softwareLicense: "gpl-3.0",
    softwareMinimalVersion: undefined,
    similarSoftwareExternalDataIds: [],
    softwareLogoUrl: undefined,
    softwareKeywords: ["Geochronology", "Age-depth modeling", "Stratigraphy", "Sedimentology"]
};

const resultRequest = [
    {
        "description":
            "R package to estimate age-depth models and transform data between the time domain and the stratigraphic domain.",
        "externalId": "15479049",
        "isLibreSoftware": true,
        "label": "admtools",
        "sourceSlug": "zenodo"
    }
];

describe.skip("zenodoSourceGateway", () => {
    const zenodoSource: Source = {
        slug: "zenodo",
        kind: "Zenodo",
        url: "https://zenodo.org",
        priority: 1,
        description: undefined
    };

    beforeAll(() => {});

    it("should have the correct sourceType and sourceProfile", () => {
        expect(zenodoSourceGateway.sourceType).toBe("Zenodo");
        expect(zenodoSourceGateway.sourceProfile).toBe("Primary");
    });

    describe("softwareExternalData", () => {
        it("should call getZenodoExternalData when getById is called", async () => {
            const result = await zenodoSourceGateway.softwareExternalData.getById({
                externalId: "15479049",
                source: zenodoSource
            });
            expect(result).toEqual(admtoolsSoftware);
        });
    });

    describe("softwareOptions", () => {
        it("should call getZenodoSoftwareOptions when getById is called", async () => {
            const result = await zenodoSourceGateway.softwareOptions.getById({
                source: zenodoSource,
                queryString: "admtools",
                language: "en"
            });

            expect(result).toEqual(resultRequest);
        });
    });

    describe("softwareForm", () => {
        it("should call getZenodoSoftwareFormData when getById is called", async () => {
            const result = await zenodoSourceGateway.softwareForm.getById({
                externalId: "15479049",
                source: zenodoSource
            });

            expect(result).toEqual(amdSoftwareForm);
        });
    });
});
