// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { makeRorOrgApi, RorSource } from "./index";
import { describe, expect, it, beforeAll } from "vitest";

describe("fetchRorOrganizationById - Integration Tests", () => {
    let rorApiAgent: RorSource;

    beforeAll(async () => {
        rorApiAgent = makeRorOrgApi();
    });

    it("should return a SchemaOrganization for a valid ROR ID", async () => {
        const result = await rorApiAgent.organization.get("02feahw73");

        expect(result).not.toBeNull();

        expect(result).toHaveProperty("name", "Centre National de la Recherche Scientifique");
        expect(result).toHaveProperty("foundingDate", "1939");

        expect(result?.sameAs).toBeUndefined();

        expect(result?.identifiers).toBeDefined();
        expect(result?.identifiers).toEqual([
            {
                "@type": "PropertyValue",
                "additionalType": "Organization",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "ROR",
                    "name": "Research Organization Registry",
                    "url": new URL("https://ror.org/")
                },
                "url": "https://ror.org/02feahw73",
                "value": "02feahw73"
            },
            {
                "@type": "PropertyValue",
                "additionalType": "fundref",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "CROSSREF",
                    "name": "One of the official Identifier Registration Agencies",
                    "url": new URL("https://www.crossref.org/")
                },
                "url": "https://api.crossref.org/funders/501100004794",
                "value": "501100004794"
            },
            {
                "@type": "PropertyValue",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "GRID",
                    "name": "Global Research Identifier Database",
                    "url": new URL("https://www.grid.ac/")
                },
                "value": "grid.4444.0"
            },
            {
                "@type": "PropertyValue",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "INSI",
                    "name": "International Standard Name Identifier",
                    "url": new URL("https://insi.org/")
                },
                "url": "http://isni.org/isni/0000 0001 2259 7504",
                "value": "0000 0001 2259 7504"
            },
            {
                "@type": "PropertyValue",
                "name": "ID on Wikidata",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "wikidata",
                    "name": "Wikidata",
                    "url": new URL("https://www.wikidata.org/")
                },
                "url": "https://www.wikidata.org/wiki/Q280413",
                "value": "Q280413"
            }
        ]);
    });

    it("should return a SchemaOrganization for a valid ROR ID", async () => {
        const result = await rorApiAgent.organization.get("03cwzta72");

        expect(result).not.toBeNull();

        expect(result).toHaveProperty("name", "Direction des Energies");
        expect(result).toHaveProperty("foundingDate", "2020");

        expect(result?.sameAs).toBeUndefined();

        expect(result?.identifiers).toBeDefined();
        expect(result?.identifiers).toEqual([
            {
                "@type": "PropertyValue",
                "additionalType": "Organization",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "ROR",
                    "name": "Research Organization Registry",
                    "url": new URL("https://ror.org/")
                },
                "url": "https://ror.org/03cwzta72",
                "value": "03cwzta72"
            },
            {
                "@type": "PropertyValue",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "GRID",
                    "name": "Global Research Identifier Database",
                    "url": new URL("https://www.grid.ac/")
                },
                "value": "grid.457258.9"
            },
            {
                "@type": "PropertyValue",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "INSI",
                    "name": "International Standard Name Identifier",
                    "url": new URL("https://insi.org/")
                },
                "url": "http://isni.org/isni/0000 0001 2180 4137",
                "value": "0000 0001 2180 4137"
            },
            {
                "@type": "PropertyValue",
                "name": "ID on Wikidata",
                "subjectOf": {
                    "@type": "Website",
                    "additionalType": "wikidata",
                    "name": "Wikidata",
                    "url": new URL("https://www.wikidata.org/")
                },
                "url": "https://www.wikidata.org/wiki/Q30299415",
                "value": "Q30299415"
            }
        ]);
    });

    it("should return null for an invalid ROR ID", async () => {
        const result = await rorApiAgent.organization.get("invalidRorId");

        expect(result).toBeUndefined();
    });

    it("should handle API errors gracefully", async () => {
        const result = await rorApiAgent.organization.get("malformed_id");

        expect(result).toBeUndefined();
    });
});
