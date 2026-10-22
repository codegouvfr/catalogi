// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import type { DbApiV2 } from "../ports/DbApiV2";
import type { RepositoryResolution } from "../ports/ResolveRepository";
import type { DiscoveredSource } from "./discoverSourcesByRepository";
import type { Source, SoftwareSourceData } from "./readWriteSillData";
import { makeResolveRepoUrl } from "./resolveRepoUrl";
import { makeRepositoryCheckCache } from "./repositoryCheckCache";

const github: Source = {
    slug: "github-com",
    kind: "GitHub",
    category: "repository",
    url: "https://github.com/",
    description: undefined,
    configuration: undefined,
    lastImport: undefined
};

// Software #3 is bound to the GitHub repository `Org/Repo`; software #8 gives
// `https://codeberg.org/Org/Tool` as repository url.
const makeDbApi = () =>
    ({
        source: { getAll: async () => [github] },
        software: {
            getSoftwareIdByExternalIdAndSlug: async (params: {
                externalId: string;
                sourceSlug: string;
                ignoreCase?: boolean;
            }) => {
                const externalId = params.ignoreCase ? params.externalId.toLowerCase() : params.externalId;
                const stored = params.ignoreCase ? "org/repo" : "Org/Repo";
                return params.sourceSlug === "github-com" && externalId === stored ? 3 : undefined;
            }
        },
        softwareExternalData: {
            getOtherIdentifierIdsBySourceURL: async () => ({}),
            getSoftwareIdByCodeRepositoryUrl: async ({ repoUrl }: { repoUrl: string }) =>
                repoUrl.toLowerCase() === "https://codeberg.org/org/tool" ? 8 : undefined
        }
    }) as unknown as DbApiV2;

const otherRepository = {
    forgeKind: "GitHub",
    url: "https://github.com/other/repo",
    externalId: "other/repo",
    name: "repo",
    description: undefined,
    license: "MIT",
    image: undefined,
    keywords: []
} as const;

const wikidataEntry = (existingSoftwareId: number | undefined): DiscoveredSource => ({
    sourceSlug: "wikidata",
    sourceKind: "wikidata",
    externalId: "Q1",
    name: "Repo",
    url: "https://www.wikidata.org/wiki/Q1",
    existingSoftwareId
});

const makeUseCase = (params: { resolution: RepositoryResolution; discoveredSources?: DiscoveredSource[] }) => {
    const fetchedFor: DiscoveredSource[][] = [];
    const resolvedUrls: string[] = [];
    const repositoryCheckCache = makeRepositoryCheckCache();
    const resolveRepoUrl = makeResolveRepoUrl({
        dbApi: makeDbApi(),
        repositoryCheckCache,
        resolveRepository: async ({ url }) => {
            resolvedUrls.push(url);
            return params.resolution;
        },
        discoverSourcesByRepository: async () => params.discoveredSources ?? [],
        fetchDiscoveredSourcesData: async ({ discoveredSources }) => {
            fetchedFor.push(discoveredSources);
            return discoveredSources.map(({ sourceSlug }) => ({ sourceSlug }) as SoftwareSourceData);
        }
    });
    return { resolveRepoUrl, fetchedFor, resolvedUrls, repositoryCheckCache };
};

describe("resolveRepoUrl", () => {
    it("rejects what is not a repository url", async () => {
        const { resolveRepoUrl } = makeUseCase({ resolution: { status: "unsupported", url: undefined } });

        expect(await resolveRepoUrl({ url: "not an url" })).toEqual({ status: "invalid" });
    });

    it("returns the forge data and the data of the discovered entries", async () => {
        const { resolveRepoUrl, fetchedFor } = makeUseCase({
            resolution: { status: "found", repository: { ...otherRepository, keywords: [] } },
            discoveredSources: [wikidataEntry(undefined)]
        });

        const resolution = await resolveRepoUrl({ url: "https://github.com/other/repo" });

        expect(resolution).toMatchObject({
            status: "found",
            externalId: "other/repo",
            license: "MIT",
            existingSoftwareId: undefined,
            discoveredDataBySource: [{ sourceSlug: "wikidata" }]
        });
        expect(fetchedFor).toEqual([[wikidataEntry(undefined)]]);
    });

    it("finds a known GitHub repository even when GitHub doesn't answer", async () => {
        const { resolveRepoUrl } = makeUseCase({ resolution: { status: "unreachable", forgeKind: "GitHub" } });

        const resolution = await resolveRepoUrl({ url: "https://www.github.com/org/repo/issues" });

        expect(resolution).toMatchObject({
            status: "unreachable",
            forgeKind: "GitHub",
            codeRepositoryUrl: "https://github.com/org/repo",
            existingSoftwareId: 3
        });
    });

    it("finds a known software through a discovered entry, without fetching its data", async () => {
        const { resolveRepoUrl, fetchedFor } = makeUseCase({
            resolution: { status: "unsupported", url: "https://codeberg.org/org/repo" },
            discoveredSources: [wikidataEntry(5)]
        });

        const resolution = await resolveRepoUrl({ url: "https://codeberg.org/org/repo/src/branch/main" });

        expect(resolution).toMatchObject({
            status: "unsupported",
            codeRepositoryUrl: "https://codeberg.org/org/repo",
            existingSoftwareId: 5,
            discoveredDataBySource: []
        });
        expect(fetchedFor).toEqual([]);
    });

    it("finds a software giving the repository url in its external data, whatever the spelling", async () => {
        const { resolveRepoUrl } = makeUseCase({
            resolution: { status: "unsupported", url: "https://codeberg.org/org/tool" }
        });

        const resolution = await resolveRepoUrl({ url: "https://codeberg.org/org/tool/" });

        expect(resolution).toMatchObject({ status: "unsupported", existingSoftwareId: 8 });
    });

    it("keeps what the form showed for the creation, and asks the forge only once for a found repository", async () => {
        const { resolveRepoUrl, resolvedUrls, repositoryCheckCache } = makeUseCase({
            resolution: { status: "found", repository: { ...otherRepository, keywords: [] } },
            discoveredSources: [wikidataEntry(undefined)]
        });

        await resolveRepoUrl({ url: "https://github.com/Other/Repo.git" });
        await resolveRepoUrl({ url: "https://github.com/other/repo/" });

        expect(resolvedUrls).toEqual(["https://github.com/Other/Repo"]);
        expect(repositoryCheckCache.get("https://github.com/other/repo")).toEqual({
            repository: { ...otherRepository, keywords: [] },
            discoveredSources: [wikidataEntry(undefined)]
        });
    });

    it("asks the forge again when it didn't answer", async () => {
        const { resolveRepoUrl, resolvedUrls } = makeUseCase({
            resolution: { status: "unreachable", forgeKind: "GitHub" }
        });

        await resolveRepoUrl({ url: "https://github.com/other/repo" });
        await resolveRepoUrl({ url: "https://github.com/other/repo" });

        expect(resolvedUrls).toEqual(["https://github.com/other/repo", "https://github.com/other/repo"]);
    });
});
