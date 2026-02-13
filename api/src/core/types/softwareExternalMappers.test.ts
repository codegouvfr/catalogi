// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import type { DatabaseDataType } from "../ports/DbApiV2";
import type { GetSoftwareExternalData, SoftwareExternalData } from "../ports/GetSoftwareExternalData";
import {
    toCanonicalSoftwareExternal,
    toCanonicalSoftwareExternalGetter,
    toLegacySoftwareExternalData
} from "./softwareExternalMappers";

describe("softwareExternalMappers", () => {
    it("maps legacy external data to canonical external software with explicit defaults", () => {
        const legacy: SoftwareExternalData = {
            externalId: "pkg-1",
            sourceSlug: "wikidata",
            developers: [{ "@type": "Person", name: "Alice" }],
            label: { fr: "Outil", en: "Tool" },
            description: { fr: "Description", en: "Description" },
            isLibreSoftware: undefined,
            logoUrl: undefined,
            websiteUrl: undefined,
            sourceUrl: undefined,
            documentationUrl: undefined,
            license: undefined,
            softwareVersion: "1.2.3",
            keywords: undefined,
            programmingLanguages: undefined,
            applicationCategories: undefined,
            publicationTime: undefined,
            referencePublications: undefined,
            identifiers: undefined,
            providers: undefined,
            repoMetadata: undefined
        };

        const got = toCanonicalSoftwareExternal({ legacy });

        expect(got.variant).toBe("external");
        expect(got.externalId).toBe("pkg-1");
        expect(got.sourceSlug).toBe("wikidata");
        expect(got.addedTime).toBe("1970-01-01T00:00:00.000Z");
        expect(got.updateTime).toBe("1970-01-01T00:00:00.000Z");
        expect(got.operatingSystems).toEqual({
            windows: false,
            linux: false,
            mac: false,
            android: false,
            ios: false
        });
        expect(got.runtimePlatforms).toEqual([]);
        expect(got.sameAs).toEqual([]);
    });

    it("maps db row to legacy external data and normalizes repo metadata dates", () => {
        const row = {
            externalId: "pkg-2",
            sourceSlug: "github",
            developers: [{ "@type": "Organization", name: "Org" }],
            label: { fr: "Nom", en: "Name" },
            description: { fr: "Desc", en: "Desc" },
            repoMetadata: {
                healthCheck: {
                    lastCommit: 1700000000000
                }
            }
        } as unknown as DatabaseDataType.SoftwareExternalDataRow;

        const got = toLegacySoftwareExternalData(row);

        expect(got.repoMetadata?.healthCheck?.lastCommit).toBeInstanceOf(Date);
    });

    it("wraps a legacy getter into a canonical getter and preserves clear", async () => {
        const getLegacy: GetSoftwareExternalData = Object.assign(
            async () =>
                ({
                    externalId: "pkg-3",
                    sourceSlug: "zenodo",
                    developers: [],
                    label: { en: "Pkg 3" },
                    description: { en: "Desc" },
                    isLibreSoftware: undefined,
                    logoUrl: undefined,
                    websiteUrl: undefined,
                    sourceUrl: undefined,
                    documentationUrl: undefined,
                    license: undefined,
                    softwareVersion: undefined,
                    keywords: undefined,
                    programmingLanguages: undefined,
                    applicationCategories: undefined,
                    publicationTime: undefined,
                    referencePublications: undefined,
                    identifiers: undefined,
                    providers: undefined,
                    repoMetadata: undefined
                }) as SoftwareExternalData,
            {
                clear: () => undefined
            }
        );

        const getCanonical = toCanonicalSoftwareExternalGetter(getLegacy);
        const result = await getCanonical({
            externalId: "pkg-3",
            source: {
                slug: "zenodo",
                kind: "Zenodo",
                url: "https://zenodo.org/",
                priority: 1,
                description: {}
            }
        });

        expect(result?.variant).toBe("external");
        expect(result?.name).toEqual({ en: "Pkg 3" });
        expect(result?.externalId).toBe("pkg-3");
        expect(typeof getCanonical.clear).toBe("function");
    });
});
