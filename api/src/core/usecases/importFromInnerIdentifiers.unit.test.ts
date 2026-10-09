// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, it } from "vitest";
import { expectToEqual } from "../../tools/test.helpers";
import { identifersUtils } from "../../tools/identifiersTools";
import type { DatabaseDataType, DbApiV2 } from "../ports/DbApiV2";
import { makeImportFromInnerIdentifiers } from "./importFromInnerIdentifiers";

type SavedIds = { sourceSlug: string; externalId: string; softwareId?: number };

const makeSource = (source: Pick<DatabaseDataType.SourceRow, "slug" | "kind" | "url">) =>
    ({ priority: 1, ...source }) as DatabaseDataType.SourceRow;

const sources = [
    makeSource({ slug: "comptoir-du-libre", kind: "ComptoirDuLibre", url: "https://comptoir-du-libre.org/" }),
    makeSource({ slug: "wikidata", kind: "wikidata", url: "https://www.wikidata.org/" }),
    makeSource({ slug: "cnll", kind: "CNLL", url: "https://cnll.fr/" })
];

const makeDbApi = (externalDataRows: Partial<DatabaseDataType.SoftwareExternalDataRow>[]) => {
    const saved: SavedIds[] = [];

    const dbApi = {
        source: { getAll: async () => sources },
        softwareExternalData: {
            getAll: async () => externalDataRows as DatabaseDataType.SoftwareExternalDataRow[],
            get: async ({ sourceSlug, externalId }: { sourceSlug: string; externalId: string }) =>
                externalDataRows.find(row => row.sourceSlug === sourceSlug && row.externalId === externalId) as
                    | DatabaseDataType.SoftwareExternalDataRow
                    | undefined,
            saveMany: async (params: SavedIds[]) => {
                saved.push(...params);
            }
        }
    } as unknown as DbApiV2;

    return { dbApi, saved };
};

describe("importFromInnerIdentifiers", () => {
    it("registers identifiers cited by another source, but never for CNLL (keyed by SILL id, not annuaire id)", async () => {
        const nextcloudSoftwareId = 93;
        const { dbApi, saved } = makeDbApi([
            {
                sourceSlug: "comptoir-du-libre",
                externalId: "123",
                softwareId: nextcloudSoftwareId,
                identifiers: [
                    identifersUtils.makeWikidataIdentifier({ wikidataId: "Q25874683" }),
                    identifersUtils.makeCNLLIdentifier({
                        cNNLId: "466",
                        url: "https://annuaire.cnll.fr/solutions/466"
                    })
                ]
            }
        ]);

        await makeImportFromInnerIdentifiers({ dbApi })();

        expectToEqual(saved, [{ sourceSlug: "wikidata", externalId: "Q25874683", softwareId: nextcloudSoftwareId }]);
    });
});
