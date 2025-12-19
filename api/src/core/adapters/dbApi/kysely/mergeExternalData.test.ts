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
            priority: 10, // Low priority
            kind: "regular",
            url: "http://low",
            label: "Low Label",
            description: "Low Description",
            keywords: ["low"]
        } as unknown as PopulatedExternalData;

        const highPrioData = {
            softwareId: 1,
            externalId: "high",
            sourceSlug: "high_source",
            priority: 1, // High priority
            kind: "regular",
            url: "http://high",
            label: "High Label",
            // Description undefined/missing in high prio -> should keep Low Description?
            // Note: undefined fields are usually preserved from previous if using deepmerge correctly,
            // but PopulatedExternalData might have explicit nulls/undefineds.
            keywords: ["high"]
        } as unknown as PopulatedExternalData;

        // The function sorts internally, so input order shouldn't matter
        const merged = mergeExternalData([highPrioData, lowPrioData]);

        expect(merged).toBeDefined();
        // Priority 1 should win for overlapping fields
        expect(merged?.label).toBe("High Label");
        expect(merged?.keywords).toEqual(["high", "low"]); // Array merge strategy combines them
    });

    it("preserves fields from lower priority if higher priority is missing them", () => {
        const lowPrioData = {
            softwareId: 1,
            priority: 10,
            documentationUrl: "http://docs.low"
        } as unknown as PopulatedExternalData;

        const highPrioData = {
            softwareId: 1,
            priority: 1,
            // documentationUrl missing
            websiteUrl: "http://web.high"
        } as unknown as PopulatedExternalData;

        const merged = mergeExternalData([highPrioData, lowPrioData]);

        expect(merged?.documentationUrl).toBe("http://docs.low");
        expect(merged?.websiteUrl).toBe("http://web.high");
    });
});
