// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database, SourceCategory } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import type { DbApiV2 } from "../core/ports/DbApiV2";
import { resetDB, testPgUrl } from "../tools/test.helpers";
import { ApiCaller, createTestCaller, defaultUser } from "./createTestCaller";

describe("Admin sources RPC", () => {
    let apiCaller: ApiCaller;
    let dbApi: DbApiV2;
    let kyselyDb: Kysely<Database>;
    let initialCategoryOrder: SourceCategory[];

    const adminUser: typeof defaultUser = { ...defaultUser, email: "sources.admin@example.com", role: "admin" };

    const findSource = async (slug: string) =>
        (await apiCaller.getAdminSources()).flatMap(({ sources }) => sources).find(source => source.slug === slug);

    beforeAll(async () => {
        kyselyDb = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        const rows = await kyselyDb.selectFrom("source_categories").select("category").orderBy("priority").execute();
        initialCategoryOrder = rows.map(({ category }) => category);
    });

    afterAll(async () => {
        await kyselyDb.destroy();
    });

    beforeEach(async () => {
        await resetDB(kyselyDb);
        await kyselyDb
            .insertInto("sources")
            .values([
                {
                    slug: "github-com",
                    kind: "GitHub",
                    category: "repository",
                    url: "https://github.com/",
                    configuration: JSON.stringify({ auth: "gh-secret", customHeader: "keep-me" })
                },
                { slug: "hal", kind: "HAL", category: "HAL", url: "https://hal.science" }
            ])
            .execute();
        ({ apiCaller, dbApi } = await createTestCaller({ db: kyselyDb, currentUser: adminUser }));
    });

    afterEach(async () => {
        await dbApi.source.reorderCategories({ categories: initialCategoryOrder });
    });

    it("lists every category in priority order, empty ones included, without credential values", async () => {
        const categories = await apiCaller.getAdminSources();

        expect(categories.map(({ category }) => category)).toEqual(initialCategoryOrder);
        expect(categories[0]).toMatchObject({ category: "UserInput", isLocked: true });
        expect(categories.find(({ category }) => category === "ROR")?.sources).toEqual([]);

        const github = await findSource("github-com");
        expect(github).toMatchObject({
            isUrlEditable: false,
            canBeLookupSource: false,
            configuration: { isCredentialSet: true, settings: {}, otherKeys: ["customHeader"] }
        });
        expect(JSON.stringify(categories)).not.toContain("gh-secret");
        expect(JSON.stringify(categories)).not.toContain("keep-me");
    });

    it("keeps the credential and unknown keys when saving without touching them", async () => {
        await apiCaller.updateSource({ slug: "github-com", configuration: { settings: { queryTimeout: 4000 } } });

        const row = await dbApi.source.getByName({ name: "github-com" });
        expect(row?.configuration).toEqual({ auth: "gh-secret", customHeader: "keep-me", queryTimeout: 4000 });
    });

    it("replaces then clears a credential", async () => {
        await apiCaller.updateSource({
            slug: "hal",
            configuration: { credential: { action: "replace", value: "hal-token" }, settings: { queryTimeout: 5000 } }
        });
        expect((await dbApi.source.getByName({ name: "hal" }))?.configuration).toEqual({
            auth: "hal-token",
            queryTimeout: 5000
        });

        await apiCaller.updateSource({ slug: "hal", configuration: { credential: { action: "clear" } } });
        expect((await findSource("hal"))?.configuration).toEqual({
            isCredentialSet: false,
            settings: { queryTimeout: 5000 },
            otherKeys: []
        });
    });

    it("refuses to change the url of a forge, and any edition of the user input", async () => {
        await expect(
            apiCaller.updateSource({ slug: "github-com", url: "https://github.example.org/" })
        ).rejects.toThrow("cannot be changed");
        await expect(apiCaller.updateSource({ slug: "UserInput", configuration: {} })).rejects.toThrow(
            "cannot be edited"
        );

        await apiCaller.updateSource({ slug: "hal", url: "https://hal.example.org" });
        expect((await dbApi.source.getByName({ name: "hal" }))?.url).toBe("https://hal.example.org");
        await expect(apiCaller.updateSource({ slug: "hal", url: "http://hal.example.org" })).rejects.toThrow("HTTPS");
    });

    it("does not move a credential to another url unless it is entered again or cleared", async () => {
        await apiCaller.updateSource({ slug: "hal", configuration: { credential: { action: "replace", value: "t" } } });

        await expect(
            apiCaller.updateSource({ slug: "hal", url: "https://elsewhere.example.org", configuration: {} })
        ).rejects.toThrow("entering the credential again");
        expect((await dbApi.source.getByName({ name: "hal" }))?.url).toBe("https://hal.science");

        await apiCaller.updateSource({
            slug: "hal",
            url: "https://elsewhere.example.org",
            configuration: { credential: { action: "clear" } }
        });
        expect((await dbApi.source.getByName({ name: "hal" }))?.configuration).toEqual({});
    });

    it("rejects settings the kind does not read", async () => {
        await expect(
            apiCaller.updateSource({
                slug: "github-com",
                configuration: { settings: { rateLimitRetryDuration: 1000 } }
            })
        ).rejects.toThrow("not a setting of GitHub");
    });

    it("swaps the lookup source, never to a forge", async () => {
        expect((await dbApi.source.getLookupSource()).slug).toBe("wikidata");

        await apiCaller.setLookupSource({ slug: "hal" });
        expect((await dbApi.source.getLookupSource()).slug).toBe("hal");
        expect((await findSource("wikidata"))?.isLookupSource).toBe(false);

        await expect(apiCaller.setLookupSource({ slug: "github-com" })).rejects.toThrow("cannot be queried by name");
        expect((await dbApi.source.getLookupSource()).slug).toBe("hal");
    });

    it("rewrites the whole category order in one go, user input first", async () => {
        const [userInput, ...rest] = initialCategoryOrder;
        const reversed = [userInput, ...[...rest].reverse()];

        await apiCaller.reorderSourceCategories({ categories: reversed });
        expect((await apiCaller.getAdminSources()).map(({ category }) => category)).toEqual(reversed);

        await expect(apiCaller.reorderSourceCategories({ categories: [...rest, userInput] })).rejects.toThrow(
            "must stay first"
        );
        await expect(apiCaller.reorderSourceCategories({ categories: [userInput] })).rejects.toThrow(
            "every source category once"
        );
    });

    it("reports that the user input has no connection to check", async () => {
        await expect(apiCaller.checkSourceConnection({ slug: "UserInput" })).resolves.toEqual({
            status: "notApplicable"
        });
    });

    it("is reserved to admins", async () => {
        await resetDB(kyselyDb);
        const { apiCaller: regularUserCaller } = await createTestCaller({ db: kyselyDb, currentUser: defaultUser });

        await expect(regularUserCaller.getAdminSources()).rejects.toThrow("FORBIDDEN");
        await expect(regularUserCaller.updateSource({ slug: "wikidata", configuration: {} })).rejects.toThrow(
            "FORBIDDEN"
        );
        await expect(regularUserCaller.setLookupSource({ slug: "wikidata" })).rejects.toThrow("FORBIDDEN");
        await expect(regularUserCaller.reorderSourceCategories({ categories: initialCategoryOrder })).rejects.toThrow(
            "FORBIDDEN"
        );
        await expect(regularUserCaller.checkSourceConnection({ slug: "wikidata" })).rejects.toThrow("FORBIDDEN");
    });

    it("never sends the lookup source configuration to the browser", async () => {
        await dbApi.source.update({ slug: "wikidata", configuration: { auth: "wd-secret" } });

        const lookupSource = await apiCaller.getLookupSource();
        expect(lookupSource.slug).toBe("wikidata");
        expect(lookupSource).not.toHaveProperty("configuration");
    });
});
