// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import type { WikidataEntity, WikidataTime } from "../../../tools/WikidataEntity";
import { latestVersionClaim } from "./getWikidataSoftware";

type WikidataVersionClaim = WikidataEntity["claims"][string][number];

const wikidataTime = (time: string): WikidataTime => ({
    after: 0,
    before: 0,
    calendarmodel: "http://www.wikidata.org/entity/Q1985727",
    precision: 11,
    time,
    timezone: 0
});

const makeVersionClaim = (params: {
    version: string;
    rank?: WikidataVersionClaim["rank"];
    publicationTime?: string;
}): WikidataVersionClaim => ({
    type: "statement",
    id: params.version,
    rank: params.rank ?? "normal",
    mainsnak: {
        snaktype: "value",
        property: "P348",
        hash: params.version,
        datavalue: {
            type: "string",
            value: params.version
        },
        datatype: "string"
    },
    qualifiers:
        params.publicationTime === undefined
            ? undefined
            : {
                  P577: [
                      {
                          snaktype: "value",
                          property: "P577",
                          hash: params.publicationTime,
                          datavalue: {
                              type: "time",
                              value: wikidataTime(params.publicationTime)
                          },
                          datatype: "time"
                      }
                  ]
              }
});

const makeEntity = (claims: WikidataVersionClaim[]): WikidataEntity => ({
    pageid: 0,
    ns: 0,
    title: "Q0",
    lastrevid: 0,
    modified: "",
    type: "item",
    id: "Q0",
    labels: {},
    descriptions: {},
    aliases: {},
    claims: { P348: claims },
    sitelinks: {}
});

const getSelectedVersion = (claims: WikidataVersionClaim[]): string | undefined => {
    const value = latestVersionClaim(makeEntity(claims))?.mainsnak.datavalue.value;

    return typeof value === "string" ? value : undefined;
};

describe("latestVersionClaim", () => {
    it("prefers the Wikidata preferred rank", () => {
        const selectedVersion = getSelectedVersion([
            makeVersionClaim({ version: "Version bêta", publicationTime: "+2017-01-01T00:00:00Z" }),
            makeVersionClaim({ version: "version 5", publicationTime: "+2022-03-01T00:00:00Z" }),
            makeVersionClaim({
                version: "version 9",
                rank: "preferred",
                publicationTime: "+2025-12-01T00:00:00Z"
            })
        ]);

        expect(selectedVersion).toBe("version 9");
    });

    it("uses the latest publication date when claims have the same rank", () => {
        const selectedVersion = getSelectedVersion([
            makeVersionClaim({ version: "Version bêta", publicationTime: "+2017-01-01T00:00:00Z" }),
            makeVersionClaim({ version: "version 9", publicationTime: "+2025-12-01T00:00:00Z" })
        ]);

        expect(selectedVersion).toBe("version 9");
    });

    it("compares embedded version numbers when no publication date is available", () => {
        const selectedVersion = getSelectedVersion([
            makeVersionClaim({ version: "Version bêta" }),
            makeVersionClaim({ version: "version 1" }),
            makeVersionClaim({ version: "version 9" })
        ]);

        expect(selectedVersion).toBe("version 9");
    });

    it("ignores deprecated version claims", () => {
        const selectedVersion = getSelectedVersion([
            makeVersionClaim({ version: "2.4.68" }),
            makeVersionClaim({ version: "99.0.0-alpha", rank: "deprecated" })
        ]);

        expect(selectedVersion).toBe("2.4.68");
    });

    it("returns undefined when every version claim is deprecated", () => {
        const selectedVersion = getSelectedVersion([makeVersionClaim({ version: "99.0.0-alpha", rank: "deprecated" })]);

        expect(selectedVersion).toBeUndefined();
    });
});
