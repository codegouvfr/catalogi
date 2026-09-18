import { describe, expect, it } from "vitest";
import { catalogV2Schema } from "./schema";
import { createOpenApiDocument } from "./openapi";
import catalog from "./fixtures/catalog-v2.json";

describe("V2 JSON contract", () => {
    it("preserves real public data, including dereferenced software and historical Wikidata values", () => {
        expect(catalogV2Schema.parse(catalog)).toEqual(catalog);
    });

    it("rejects an incompatible change to software IDs", () => {
        const data = [{ ...catalog[0], id: "1" }];
        expect(catalogV2Schema.safeParse(data).success).toBe(false);
    });

    it("documents recursive organizations with resolvable references", () => {
        const doc = createOpenApiDocument();
        const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/([^"/]+)"/g)];
        expect(refs.length).toBeGreaterThan(0);
        for (const [, name] of refs) expect(doc.components?.schemas?.[name]).toBeDefined();
        expect(doc.components?.schemas?.Organization).toBeDefined();
    });

    it("accepts nested providers and multilingual descriptions", () => {
        const software = {
            ...catalog[0],
            description: { fr: "Description", en: "Description" },
            providers: [
                {
                    "@type": "Organization",
                    name: "Provider",
                    memberOf: [
                        {
                            "@type": "Organization",
                            name: "Group",
                            parentOrganizations: [{ "@type": "Organization", name: "Parent" }]
                        }
                    ]
                }
            ]
        };
        expect(catalogV2Schema.parse([software])).toEqual([software]);
    });
});
