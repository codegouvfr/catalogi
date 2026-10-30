// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { halSourceGateway } from "../adapters/hal";
import { categoryByKind, Database, USER_INPUT_SOURCE_SLUG } from "../adapters/dbApi/kysely/kysely.database";
import { createKyselyPgDbApi } from "../adapters/dbApi/kysely/createPgDbApi";
import { createPgDialect } from "../adapters/dbApi/kysely/kysely.dialect";
import { wikidataSourceGateway } from "../adapters/wikidata";
import type { DbApiV2 } from "../ports/DbApiV2";
import { createSoftwareFormData, resetDB, testPgUrl, testSource } from "../../tools/test.helpers";
import type { Source } from "./readWriteSillData";
import { importFromSource } from "./importFromSource";

const halSource: Source = {
    ...testSource,
    slug: "hal-science",
    category: "HAL",
    kind: "HAL",
    url: "https://hal.science"
};

const makeSoftwareForm = (source: Source, externalId: string, name: string) =>
    createSoftwareFormData({
        externalIdForSource: externalId,
        sourceSlug: source.slug,
        name,
        nameOverride: name,
        similarSoftwareExternalDataItems: []
    });

describe("importFromSource", () => {
    let dbApi: DbApiV2;
    let db: Kysely<Database>;

    beforeEach(async () => {
        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        await resetDB(db);
        dbApi = createKyselyPgDbApi(db);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("imports software IDs discovered from HAL", async () => {
        await db
            .insertInto("sources")
            .values({
                slug: halSource.slug,
                kind: halSource.kind,
                category: halSource.category,
                url: halSource.url,
                description: null,
                configuration: null,
                lastImport: null
            })
            .execute();

        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ response: { docs: [{ docid: "hal-123" }] } }), { status: 200 })
        );
        const getSoftwareForm = vi
            .spyOn(halSourceGateway.software, "getSoftwareForm")
            .mockImplementation(async ({ externalId, source }) => makeSoftwareForm(source, externalId, "HAL software"));

        const importedIds = await importFromSource(dbApi)({
            userEmail: "hal-import@example.com",
            source: halSource
        });

        expect(importedIds).toHaveLength(1);
        expect(getSoftwareForm).toHaveBeenCalledWith({ externalId: "hal-123", source: halSource });
        expect(await dbApi.software.getFullList()).toEqual([
            expect.objectContaining({ id: importedIds[0], name: "HAL software" })
        ]);
        expect(await dbApi.softwareExternalData.getAll()).toEqual([
            expect.objectContaining({ externalId: "hal-123", sourceSlug: halSource.slug, softwareId: importedIds[0] })
        ]);
    });

    it("imports Wikidata software by the supplied IDs", async () => {
        const getSoftwareForm = vi
            .spyOn(wikidataSourceGateway.software, "getSoftwareForm")
            .mockImplementation(async ({ externalId, source }) =>
                makeSoftwareForm(source, externalId, `Wikidata software ${externalId}`)
            );

        const importedIds = await importFromSource(dbApi)({
            userEmail: "wikidata-import@example.com",
            source: testSource,
            softwareIdOnSource: ["Q123", "Q456"],
            catalogStatusTarget: "submitted"
        });

        expect(importedIds).toHaveLength(2);
        expect(getSoftwareForm).toHaveBeenNthCalledWith(1, { externalId: "Q123", source: testSource });
        expect(getSoftwareForm).toHaveBeenNthCalledWith(2, { externalId: "Q456", source: testSource });
        expect(await dbApi.softwareExternalData.getAll()).toEqual([
            expect.objectContaining({ externalId: "Q123", sourceSlug: testSource.slug, softwareId: importedIds[0] }),
            expect.objectContaining({ externalId: "Q456", sourceSlug: testSource.slug, softwareId: importedIds[1] })
        ]);
        const importedSoftwareStatuses = await db
            .selectFrom("softwares")
            .select(["id", "name", "status"])
            .orderBy("id")
            .execute();
        expect(importedSoftwareStatuses).toEqual([
            expect.objectContaining({
                id: importedIds[0],
                name: "Wikidata software Q123",
                status: expect.objectContaining({ name: "submitted" })
            }),
            expect.objectContaining({
                id: importedIds[1],
                name: "Wikidata software Q456",
                status: expect.objectContaining({ name: "submitted" })
            })
        ]);
    });

    it.each(["CNLL", "RNSR", "ROR"] as const)("rejects imports from the secondary source %s", async kind => {
        const source: Source = {
            ...testSource,
            slug: kind.toLowerCase(),
            category: kind,
            kind,
            url: "https://example.com"
        };

        await expect(
            importFromSource(dbApi)({
                userEmail: "secondary-source-import@example.com",
                source
            })
        ).rejects.toThrow("[UC:Import] Import if not possible from a secondary source");
    });

    it("rejects imports from the UserInput source because it has no software gateway", async () => {
        const source: Source = {
            ...testSource,
            slug: USER_INPUT_SOURCE_SLUG,
            category: "UserInput",
            kind: USER_INPUT_SOURCE_SLUG,
            url: ""
        };

        await expect(
            importFromSource(dbApi)({
                userEmail: "user-input-import@example.com",
                source
            })
        ).rejects.toThrow("[UC:Import] Import if not possible from a secondary source");
        expect(await db.selectFrom("users").selectAll().execute()).toHaveLength(0);
    });

    it.each(["ComptoirDuLibre", "wikidata", "GitHub", "GitLab"] as const)(
        "rejects a direct import from %s when no IDs are supplied",
        async kind => {
            const source: Source = {
                ...testSource,
                slug: kind.toLowerCase(),
                category: categoryByKind[kind],
                kind,
                url: "https://example.com"
            };

            await expect(
                importFromSource(dbApi)({
                    userEmail: `massive-import-${kind.toLowerCase()}@example.com`,
                    source
                })
            ).rejects.toThrow("[UC:Import] Not Implemented, but you can specify the list of ids you want to import");
        }
    );
});
