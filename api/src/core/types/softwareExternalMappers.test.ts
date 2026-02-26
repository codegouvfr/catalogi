// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import type { DatabaseDataType } from "../ports/DbApiV2";
import { toLegacySoftwareExternalData } from "./softwareExternalMappers";

describe("softwareExternalMappers", () => {
    it("maps db row to legacy external data and normalizes repo metadata dates", () => {
        const row = {
            externalId: "pkg-2",
            sourceSlug: "github",
            developers: [{ "@type": "Organization", name: "Org" }],
            name: { fr: "Nom", en: "Name" },
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
});
