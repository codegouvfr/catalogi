// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { RestWikidataEntity } from "./restApi";
import { convertWikidataToSchemaOrganization } from "./getOrganisation";

const createWikidataEntity = (entity: Partial<RestWikidataEntity>): RestWikidataEntity => ({
    type: "item",
    id: "Q0",
    labels: {},
    descriptions: {},
    aliases: {},
    statements: {},
    sitelinks: {},
    ...entity
});

describe("convertWikidataToSchemaOrganization", () => {
    it("converts organization identity and address fields from Wikidata REST entities", () => {
        const organisationEntity = createWikidataEntity({
            id: "Q280413",
            labels: { fr: "Centre national de la recherche scientifique" },
            descriptions: { fr: "organisme public français de recherche scientifique" },
            aliases: { fr: ["CNRS", "CNRS"] },
            statements: {
                P856: [
                    {
                        id: "Q280413$website",
                        rank: "normal",
                        property: { id: "P856", data_type: "url" },
                        value: { type: "value", content: "https://www.cnrs.fr/" }
                    }
                ],
                P571: [
                    {
                        id: "Q280413$founding-date",
                        rank: "normal",
                        property: { id: "P571", data_type: "time" },
                        value: { type: "value", content: { time: "+1939-10-19T00:00:00Z" } }
                    }
                ],
                P159: [
                    {
                        id: "Q280413$headquarters",
                        rank: "normal",
                        property: { id: "P159", data_type: "wikibase-item" },
                        value: { type: "value", content: "Q0" },
                        qualifiers: [
                            {
                                property: { id: "P6375", data_type: "monolingualtext" },
                                value: { type: "value", content: { text: "3 rue Michel-Ange" } }
                            },
                            {
                                property: { id: "P281", data_type: "string" },
                                value: { type: "value", content: "75794 cedex 16" }
                            }
                        ]
                    }
                ]
            }
        });

        const countryEntity = createWikidataEntity({ labels: { fr: "France" } });

        const result = convertWikidataToSchemaOrganization({ organisationEntity, countryEntity });

        expect(result).toEqual({
            "@type": "Organization",
            name: "Centre national de la recherche scientifique",
            alternateName: ["CNRS"],
            description: "organisme public français de recherche scientifique",
            url: "https://www.cnrs.fr/",
            foundingDate: "1939",
            address: {
                "@type": "PostalAddress",
                addressCountry: "France",
                postalCode: "75794 cedex 16",
                streetAddress: "3 rue Michel-Ange"
            }
        });
    });
});
