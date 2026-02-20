// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, it, expect } from "vitest";
import { mergeExternalData } from "./mergeExternalData";
import { PopulatedExternalData } from "../../../ports/DbApiV2";

describe("mergeExternalData", () => {
    it("merges data such that Priority 1 (High) overrides Priority 10 (Low)", () => {
        const lowPrioData = {
            softwareId: 1,
            externalId: "low",
            sourceSlug: "low_source",
            priority: 10,
            kind: "regular",
            sourceUrl: "http://low",
            name: "Low Label",
            description: "Low Description",
            keywords: ["low"]
        } as unknown as PopulatedExternalData;

        const highPrioData = {
            softwareId: 1,
            externalId: "high",
            sourceSlug: "high_source",
            priority: 1,
            kind: "regular",
            sourceUrl: "http://high",
            name: "High Label",
            keywords: ["high"]
        } as unknown as PopulatedExternalData;

        const merged = mergeExternalData([highPrioData, lowPrioData]);

        expect(merged).toBeDefined();
        expect(merged?.name).toBe("High Label");
        expect(merged?.keywords).toEqual(["low", "high"]);
    });

    it("preserves keyword order when merging multiple items", () => {
        const highPrioData = {
            softwareId: 1,
            priority: 1,
            keywords: ["a", "b", "c"]
        } as unknown as PopulatedExternalData;

        const lowPrioData = {
            softwareId: 1,
            priority: 10,
            keywords: ["d", "e"]
        } as unknown as PopulatedExternalData;

        const merged = mergeExternalData([highPrioData, lowPrioData]);
        expect(merged?.keywords).toEqual(["d", "e", "a", "b", "c"]);
    });

    it("preserves fields from lower priority if higher priority is missing them", () => {
        const lowPrioData = {
            softwareId: 1,
            priority: 10,
            softwareHelp: "http://docs.low"
        } as unknown as PopulatedExternalData;

        const highPrioData = {
            softwareId: 1,
            priority: 1,
            url: "http://web.high"
        } as unknown as PopulatedExternalData;

        const merged = mergeExternalData([highPrioData, lowPrioData]);

        expect(merged?.softwareHelp).toBe("http://docs.low");
        expect(merged?.url).toBe("http://web.high");
    });
});
