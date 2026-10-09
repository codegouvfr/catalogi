// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDB, testPgUrl } from "../../tools/test.helpers";
import { identifersUtils } from "../../tools/identifiersTools";
import type { DbApiV2 } from "../ports/DbApiV2";
import { createKyselyPgDbApi } from "../adapters/dbApi/kysely/createPgDbApi";
import type { Database } from "../adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../adapters/dbApi/kysely/kysely.dialect";
import { EnsureForgeSource, makeEnsureForgeSource } from "./ensureForgeSource";
import { makeImportFromInnerIdentifiers } from "./importFromInnerIdentifiers";

const humaNumRepoIdentifier = identifersUtils.makeRepoGitLabIdentifer({
    gitLabUrl: "https://gitlab.huma-num.fr",
    projectId: 42,
    projectName: "team/project"
});

describe("ensureForgeSource", () => {
    let db: Kysely<Database>;
    let dbApi: DbApiV2;
    let ensureForgeSource: EnsureForgeSource;

    beforeEach(async () => {
        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        await resetDB(db);
        dbApi = createKyselyPgDbApi(db);
        ensureForgeSource = makeEnsureForgeSource({ dbApi });
    });

    it("creates one repository source per forge instance, keyed by origin", async () => {
        const created = await ensureForgeSource({
            kind: "GitLab",
            url: "https://gitlab.huma-num.fr/team/project"
        });
        const reused = await ensureForgeSource({ kind: "GitLab", url: "https://gitlab.huma-num.fr/" });

        expect(created).toMatchObject({
            slug: "gitlab-huma-num-fr",
            kind: "GitLab",
            category: "repository",
            url: "https://gitlab.huma-num.fr"
        });
        expect(reused?.slug).toBe(created?.slug);

        const rows = await db.selectFrom("sources").select("slug").where("kind", "=", "GitLab").execute();
        expect(rows).toEqual([{ slug: "gitlab-huma-num-fr" }]);
    });

    it("reuses an existing source of the same kind and origin, whatever its slug", async () => {
        await db
            .insertInto("sources")
            .values({ slug: "GitHub", kind: "GitHub", category: "repository", url: "https://github.com/" })
            .execute();

        const source = await ensureForgeSource({ kind: "GitHub", url: "https://github.com/owner/repo" });

        expect(source?.slug).toBe("GitHub");
    });

    it("creates the GitHub source with the url its adapters expect", async () => {
        const source = await ensureForgeSource({ kind: "GitHub", url: "https://github.com/owner/repo" });

        expect(source).toMatchObject({ slug: "github-com", url: "https://github.com/" });
    });

    it("never makes a repository source the main source", async () => {
        await ensureForgeSource({ kind: "GitHub", url: "https://github.com/owner/repo" });

        expect((await dbApi.source.getMainSource()).category).not.toBe("repository");
    });

    it("refuses a GitHub kind outside github.com", async () => {
        expect(await ensureForgeSource({ kind: "GitHub", url: "https://gitlab.com/owner/repo" })).toBeUndefined();
    });

    it("does not hijack a source already using the derived slug", async () => {
        await db
            .insertInto("sources")
            .values({ slug: "gitlab-com", kind: "HAL", category: "HAL", url: "https://hal.science" })
            .execute();

        expect(await ensureForgeSource({ kind: "GitLab", url: "https://gitlab.com/a/b" })).toBeUndefined();
    });
});

describe("importFromInnerIdentifiers with forge repositories", () => {
    let db: Kysely<Database>;
    let dbApi: DbApiV2;

    const insertSoftwareCitingRepo = async (params: { id: number; wikidataId: string }) => {
        const user = await db
            .insertInto("users")
            .values({ email: `user${params.id}@example.com`, organization: "org", isPublic: true })
            .returning("id")
            .executeTakeFirstOrThrow();

        await db
            .insertInto("softwares")
            .values({
                id: params.id,
                name: `software ${params.id}`,
                isStillInObservation: false,
                addedByUserId: user.id,
                dereferencing: null,
                addedTime: new Date().toISOString(),
                updateTime: new Date().toISOString(),
                customAttributes: JSON.stringify({})
            })
            .execute();

        await db
            .insertInto("software_external_datas")
            .values({
                externalId: params.wikidataId,
                sourceSlug: "wikidata",
                softwareId: params.id,
                authors: JSON.stringify([]),
                identifiers: JSON.stringify([humaNumRepoIdentifier])
            })
            .execute();
    };

    beforeEach(async () => {
        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        await resetDB(db);
        dbApi = createKyselyPgDbApi(db);
    });

    it("creates the forge source and binds the repository to the software", async () => {
        await insertSoftwareCitingRepo({ id: 1, wikidataId: "Q1" });

        await makeImportFromInnerIdentifiers({ dbApi })();

        const rows = await db
            .selectFrom("software_external_datas")
            .select(["softwareId", "sourceSlug", "sourceCategory", "externalId"])
            .where("sourceSlug", "=", "gitlab-huma-num-fr")
            .execute();
        expect(rows).toEqual([
            { softwareId: 1, sourceSlug: "gitlab-huma-num-fr", sourceCategory: "repository", externalId: "42" }
        ]);
    });

    it("does not bind a second repository to a software", async () => {
        await insertSoftwareCitingRepo({ id: 1, wikidataId: "Q1" });
        await db
            .insertInto("sources")
            .values({ slug: "GitHub", kind: "GitHub", category: "repository", url: "https://github.com/" })
            .execute();
        await db
            .insertInto("software_external_datas")
            .values({ externalId: "owner/repo", sourceSlug: "GitHub", softwareId: 1, authors: JSON.stringify([]) })
            .execute();

        await makeImportFromInnerIdentifiers({ dbApi })();

        const rows = await db
            .selectFrom("software_external_datas")
            .select("sourceSlug")
            .where("softwareId", "=", 1)
            .where("sourceCategory", "=", "repository")
            .execute();
        expect(rows).toEqual([{ sourceSlug: "GitHub" }]);
    });
});
