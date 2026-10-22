// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import type { DbApiV2 } from "../ports/DbApiV2";
import type { GetSoftwareExternal } from "../ports/GetSoftwareExternal";
import type { FindSoftwareByRepositoryUrl } from "../ports/SourceGateway";
import type { SoftwareExternal } from "../types/SoftwareTypes";
import type { Source } from "./readWriteSillData";
import {
    makeDiscoverSourcesByRepository,
    makeFetchDiscoveredSourcesData,
    type DiscoveredSource
} from "./discoverSourcesByRepository";

const makeSource = (slug: string, kind: Source["kind"], category: Source["category"]): Source => ({
    slug,
    kind,
    category,
    url: `https://${slug}.example.org`,
    description: undefined,
    configuration: undefined,
    lastImport: undefined
});

const wikidata = makeSource("wikidata", "wikidata", "wikidata");
const otherWikidata = makeSource("other-wikidata", "wikidata", "wikidata");
const hal = makeSource("hal", "HAL", "HAL");
const github = makeSource("github-com", "GitHub", "repository");

const dbApi = {
    source: {
        getCategoryPriorities: async () => ({ repository: 1, wikidata: 2, HAL: 3, ComptoirDuLibre: 4 })
    },
    software: {
        getSoftwareIdByExternalIdAndSlug: async ({ externalId }: { externalId: string }) =>
            externalId === "Q1" ? 7 : undefined
    }
} as unknown as DbApiV2;

const repoUrl = "https://github.com/org/repo";

describe("discoverSourcesByRepository", () => {
    it("queries every source able to search by repository, with each url spelling", async () => {
        const queried: { slug: string; repoUrls: string[] }[] = [];
        const find: FindSoftwareByRepositoryUrl = async ({ source, repoUrls }) => {
            queried.push({ slug: source.slug, repoUrls });
            return source.slug === "wikidata"
                ? { externalId: "Q1", name: "Repo", url: "https://wikidata.example.org/wiki/Q1" }
                : undefined;
        };

        const discover = makeDiscoverSourcesByRepository({
            dbApi,
            getFinder: source => (source.kind === "GitHub" ? undefined : find)
        });

        const discovered = await discover({ repoUrls: [repoUrl], sources: [github, wikidata, hal] });

        expect(discovered).toEqual([
            {
                sourceSlug: "wikidata",
                sourceKind: "wikidata",
                externalId: "Q1",
                name: "Repo",
                url: "https://wikidata.example.org/wiki/Q1",
                existingSoftwareId: 7
            }
        ]);
        expect(queried.map(({ slug }) => slug)).toEqual(["wikidata", "hal"]);
        expect(queried[0].repoUrls).toEqual([repoUrl, `${repoUrl}/`, `${repoUrl}.git`]);
    });

    it("keeps a single entry per source category", async () => {
        const discover = makeDiscoverSourcesByRepository({
            dbApi,
            getFinder:
                () =>
                async ({ source }) => ({ externalId: `Q-${source.slug}`, name: undefined, url: "" })
        });

        const discovered = await discover({ repoUrls: [repoUrl], sources: [wikidata, otherWikidata] });

        expect(discovered.map(({ sourceSlug }) => sourceSlug)).toEqual(["wikidata"]);
    });

    it("skips sources failing or answering too slowly", async () => {
        const discover = makeDiscoverSourcesByRepository({
            dbApi,
            timeoutMs: 50,
            getFinder: source => {
                if (source.slug === "wikidata") return () => new Promise(() => undefined);
                if (source.slug === "hal") return async () => Promise.reject(new Error("down"));
                return async () => ({ externalId: "42", name: undefined, url: "" });
            }
        });

        const discovered = await discover({
            repoUrls: [repoUrl],
            sources: [wikidata, hal, makeSource("cdl", "ComptoirDuLibre", "ComptoirDuLibre")]
        });

        expect(discovered.map(({ sourceSlug }) => sourceSlug)).toEqual(["cdl"]);
    });
});

const makeFetcher = (fetch: (externalId: string) => Promise<SoftwareExternal | undefined>): GetSoftwareExternal =>
    Object.assign(({ externalId }: { externalId: string }) => fetch(externalId), { clear: () => undefined });

const discovered = (sourceSlug: string, externalId: string): DiscoveredSource => ({
    sourceSlug,
    sourceKind: "wikidata",
    externalId,
    name: undefined,
    url: "",
    existingSoftwareId: undefined
});

describe("fetchDiscoveredSourcesData", () => {
    const cdl = makeSource("cdl", "ComptoirDuLibre", "ComptoirDuLibre");

    it("returns the data of each discovered entry, ordered by category priority", async () => {
        const fetchData = makeFetchDiscoveredSourcesData({
            dbApi,
            getFetcher: () =>
                makeFetcher(
                    async externalId =>
                        ({ externalId, name: { fr: `name ${externalId}` } }) as unknown as SoftwareExternal
                )
        });

        const dataBySource = await fetchData({
            discoveredSources: [discovered("cdl", "458"), discovered("wikidata", "Q1")],
            sources: [cdl, wikidata]
        });

        expect(dataBySource).toMatchObject([
            {
                sourceSlug: "wikidata",
                priority: 2,
                kind: "wikidata",
                sourceUrl: wikidata.url,
                externalId: "Q1",
                name: { fr: "name Q1" }
            },
            { sourceSlug: "cdl", priority: 4, externalId: "458", name: { fr: "name 458" } }
        ]);
    });

    it("skips entries failing or answering too slowly", async () => {
        const fetchData = makeFetchDiscoveredSourcesData({
            dbApi,
            timeoutMs: 50,
            getFetcher: source => {
                if (source.slug === "wikidata") return makeFetcher(() => new Promise(() => undefined));
                if (source.slug === "hal") return makeFetcher(async () => Promise.reject(new Error("down")));
                return makeFetcher(async externalId => ({ externalId }) as unknown as SoftwareExternal);
            }
        });

        const dataBySource = await fetchData({
            discoveredSources: [discovered("wikidata", "Q1"), discovered("hal", "1"), discovered("cdl", "458")],
            sources: [wikidata, hal, cdl]
        });

        expect(dataBySource.map(({ sourceSlug }) => sourceSlug)).toEqual(["cdl"]);
    });
});
