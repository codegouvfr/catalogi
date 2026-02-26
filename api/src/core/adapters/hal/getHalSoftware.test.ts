// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, it, expect } from "vitest";
import { expectToEqual } from "../../../tools/test.helpers";
import { Source } from "../../usecases/readWriteSillData";
import { getHalSoftwareExternal } from "./getHalSoftwareExternalData";
import { getHalSoftwareOptions } from "./getHalSoftwareOptions";

describe("HAL", () => {
    const halSource: Source = {
        slug: "hal-science",
        kind: "HAL",
        url: "https://hal.science",
        priority: 1,
        description: undefined
    };
    describe("getHalSoftwareExternal", () => {
        it("gets data from Hal and converts it to ExternalSoftware", async () => {
            // https://api.archives-ouvertes.fr/search/?q=docid:1510897&wt=json&fl=*&sort=docid%20asc
            const result = await getHalSoftwareExternal({
                externalId: "1715545",
                source: halSource
            });

            expect(result).toBeDefined();
            expect(result!.variant).toBe("external");
            expect(result!.externalId).toBe("1715545");
            expect(result!.sourceSlug).toBe(halSource.slug);
            expect(result!.name).toEqual({
                "en": "Battleship exercise",
                "fr": "Battleship exercise"
            });
            expect(result!.description).toEqual({ "en": "-", "fr": undefined });
            expect(result!.isLibreSoftware).toBe(true);
            expect(result!.license).toBe("MIT License");
            expect(result!.codeRepositoryUrl).toBe("https://github.com/moranegg/Battleship");
            expect(result!.url).toBe("https://inria.hal.science/hal-01715545v1");
            expect(result!.authors).toHaveLength(1);
            expect(result!.authors[0].name).toBe("Morane Gruenpeter");
            expect(result!.applicationCategories).toEqual(["Computer Science [cs]"]);
            expect(result!.providers).toEqual([]);
            expect(result!.identifiers.length).toBeGreaterThanOrEqual(2);
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
                    name: "multisensi",
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
                    name: "multisensi : Analyse de sensibilité multivariée",
                    description: "Functions to perform sensitivity analysis on a model with multivariate output.",
                    isLibreSoftware: true,
                    sourceSlug: halSource.slug
                }
            ]);
        });
    });
});
