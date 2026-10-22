// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DbApiV2 } from "../ports/DbApiV2";
import type { GetSoftwareExternal } from "../ports/GetSoftwareExternal";
import type { FindSoftwareByRepositoryUrl } from "../ports/SourceGateway";
import type { SoftwareExternal } from "../types/SoftwareTypes";
import type { Source, SoftwareSourceData } from "./readWriteSillData";
import { resolveAdapterFromSource } from "../adapters/resolveAdapter";

export type DiscoveredSource = {
    sourceSlug: string;
    sourceKind: Source["kind"];
    externalId: string;
    name: string | undefined;
    // Page of the entry on the source.
    url: string;
    // Software this entry is already bound to.
    existingSoftwareId: number | undefined;
};

export type DiscoverSourcesByRepository = (params: {
    // Spellings of the same repository: as typed and as returned by the forge.
    repoUrls: string[];
    sources: Source[];
}) => Promise<DiscoveredSource[]>;

const defaultTimeoutMs = 5_000;

const getRepositoryFinder = (source: Source) => resolveAdapterFromSource(source).softwareExtra?.findByRepositoryUrl;

// Sources store the url the way their contributors typed it.
const repoUrlVariants = (repoUrls: string[]) =>
    Array.from(new Set(repoUrls.flatMap(url => [url, `${url}/`, `${url}.git`])));

const rejectOnAbort = (signal: AbortSignal) =>
    new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));

// Looks for the repository in every configured source able to search by repository url,
// so an instance only queries the sources it uses. A slow or failing source is skipped.
export const makeDiscoverSourcesByRepository =
    (deps: {
        dbApi: DbApiV2;
        timeoutMs?: number;
        getFinder?: (source: Source) => FindSoftwareByRepositoryUrl | undefined;
    }): DiscoverSourcesByRepository =>
    async ({ repoUrls, sources }) => {
        const { dbApi, timeoutMs = defaultTimeoutMs, getFinder = getRepositoryFinder } = deps;

        const variants = repoUrlVariants(repoUrls);
        if (variants.length === 0) return [];

        const matches = await Promise.all(
            sources.map(async source => {
                const find = getFinder(source);
                if (!find) return undefined;

                const signal = AbortSignal.timeout(timeoutMs);
                try {
                    const match = await Promise.race([
                        find({ repoUrls: variants, source, signal }),
                        rejectOnAbort(signal)
                    ]);
                    return match && { source, match };
                } catch (error) {
                    console.info(`[UC.discoverSourcesByRepository] ${source.slug} skipped: ${String(error)}`);
                    return undefined;
                }
            })
        );

        // A software has at most one external data per source category.
        const seenCategories = new Set<string>();
        const discovered = matches.filter(found => {
            if (!found || seenCategories.has(found.source.category)) return false;
            seenCategories.add(found.source.category);
            return true;
        });

        return withExistingSoftwareIds({
            dbApi,
            discoveredSources: discovered.map(found => {
                const { source, match } = found!;
                return {
                    sourceSlug: source.slug,
                    sourceKind: source.kind,
                    externalId: match.externalId,
                    name: match.name,
                    url: match.url,
                    existingSoftwareId: undefined
                };
            })
        });
    };

// The software an entry is bound to changes over time: refreshed on each use.
export const withExistingSoftwareIds = (params: {
    dbApi: DbApiV2;
    discoveredSources: DiscoveredSource[];
}): Promise<DiscoveredSource[]> =>
    Promise.all(
        params.discoveredSources.map(async discoveredSource => ({
            ...discoveredSource,
            existingSoftwareId: await params.dbApi.software.getSoftwareIdByExternalIdAndSlug({
                sourceSlug: discoveredSource.sourceSlug,
                externalId: discoveredSource.externalId
            })
        }))
    );

export type FetchDiscoveredSourcesData = (params: {
    discoveredSources: DiscoveredSource[];
    sources: Source[];
}) => Promise<SoftwareSourceData[]>;

const getSoftwareExternalFetcher = (source: Source) =>
    resolveAdapterFromSource(source).softwareExtra?.getSoftwareExternal;

const toSoftwareSourceData = (params: {
    external: SoftwareExternal;
    source: Source;
    priority: number;
}): SoftwareSourceData => {
    const { external, source, priority } = params;
    return {
        sourceSlug: source.slug,
        priority,
        kind: source.kind,
        sourceUrl: source.url,
        externalId: external.externalId,
        lastDataFetchAt: undefined,
        name: external.name,
        description: external.description,
        image: external.image,
        url: external.url,
        codeRepositoryUrl: external.codeRepositoryUrl,
        softwareHelp: external.softwareHelp,
        license: external.license,
        latestVersion: external.latestVersion,
        keywords: external.keywords,
        programmingLanguages: external.programmingLanguages,
        applicationCategories: external.applicationCategories,
        authors: external.authors,
        providers: external.providers,
        operatingSystems: external.operatingSystems,
        runtimePlatforms: external.runtimePlatforms,
        isLibreSoftware: external.isLibreSoftware,
        referencePublications: external.referencePublications,
        identifiers: external.identifiers,
        repoMetadata: external.repoMetadata
    };
};

// Shows the data of the discovered entries before the software is created, the way
// the refresh will store it. Ordered by precedence (highest first).
export const makeFetchDiscoveredSourcesData =
    (deps: {
        dbApi: DbApiV2;
        timeoutMs?: number;
        getFetcher?: (source: Source) => GetSoftwareExternal | undefined;
    }): FetchDiscoveredSourcesData =>
    async ({ discoveredSources, sources }) => {
        const { dbApi, timeoutMs = defaultTimeoutMs, getFetcher = getSoftwareExternalFetcher } = deps;
        if (discoveredSources.length === 0) return [];

        const priorities = await dbApi.source.getCategoryPriorities();

        const dataBySource = await Promise.all(
            discoveredSources.map(async ({ sourceSlug, externalId }) => {
                const source = sources.find(source => source.slug === sourceSlug);
                const getSoftwareExternal = source && getFetcher(source);
                if (!source || !getSoftwareExternal) return undefined;

                const signal = AbortSignal.timeout(timeoutMs);
                try {
                    const external = await Promise.race([
                        getSoftwareExternal({ externalId, source }),
                        rejectOnAbort(signal)
                    ]);
                    return (
                        external &&
                        toSoftwareSourceData({
                            external,
                            source,
                            priority: priorities[source.category] ?? Number.MAX_SAFE_INTEGER
                        })
                    );
                } catch (error) {
                    console.info(
                        `[UC.fetchDiscoveredSourcesData] ${sourceSlug} ${externalId} skipped: ${String(error)}`
                    );
                    return undefined;
                }
            })
        );

        return dataBySource.filter(data => data !== undefined).sort((left, right) => left.priority - right.priority);
    };
