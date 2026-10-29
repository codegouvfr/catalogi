// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DbApiV2 } from "../ports/DbApiV2";
import type { RepositoryResolution, ResolveRepository, ResolvedRepository } from "../ports/ResolveRepository";
import type {
    DiscoverSourcesByRepository,
    DiscoveredSource,
    FetchDiscoveredSourcesData
} from "./discoverSourcesByRepository";
import type { ForgeKind } from "./ensureForgeSource";
import type { Source, SoftwareSourceData } from "./readWriteSillData";
import type { RepositoryCheckCache } from "./repositoryCheckCache";
import { normalizeRepoUrl } from "../adapters/resolveRepository";

type ResolvedRepoUrl = {
    codeRepositoryUrl: string;
    // Entries of the other sources citing the repository (Wikidata, HAL...).
    discoveredSources: DiscoveredSource[];
    // Their data, ordered by precedence, to fill the form before the software exists.
    discoveredDataBySource: SoftwareSourceData[];
    // Software already known by the repository or one of the discovered entries.
    existingSoftwareId: number | undefined;
};

export type RepoUrlResolution =
    | { status: "invalid" }
    | ({ status: "unsupported" } & ResolvedRepoUrl)
    | ({ status: "notFound"; forgeKind: ForgeKind } & ResolvedRepoUrl)
    | ({ status: "unreachable"; forgeKind: ForgeKind } & ResolvedRepoUrl)
    | ({
          status: "found";
          forgeKind: ForgeKind;
          externalId: string;
          name: string;
          description: string | undefined;
          license: string | undefined;
          image: string | undefined;
          keywords: string[];
      } & ResolvedRepoUrl);

export type ResolveRepoUrl = (params: { url: string }) => Promise<RepoUrlResolution>;

type RepositoryKey = Pick<ResolvedRepository, "forgeKind" | "url" | "externalId">;

// What identifies the repository on its forge. A GitHub repository is identified by
// its path, so it is known even when GitHub doesn't answer; a GitLab project needs its id.
export const getRepositoryKey = (params: {
    resolution: RepositoryResolution;
    normalizedUrl: string;
}): RepositoryKey | undefined => {
    const { resolution, normalizedUrl } = params;
    if (resolution.status === "found") return resolution.repository;
    if (resolution.status === "unsupported" || resolution.forgeKind !== "GitHub") return undefined;

    const segments = new URL(normalizedUrl).pathname.split("/").filter(segment => segment);
    if (segments.length !== 2) return undefined;
    return { forgeKind: "GitHub", url: normalizedUrl, externalId: segments.join("/") };
};

// A repository is already known when it is bound as forge external data, when another
// source (Wikidata, HAL...) cites it as identifier of a software, or when the external
// data of a software (user input included) gives it as repository url.
export const findSoftwareIdByRepository = async (params: {
    dbApi: DbApiV2;
    sources: Source[];
    repositoryKey: RepositoryKey | undefined;
    repoUrls: string[];
}): Promise<number | undefined> => {
    const { dbApi, sources, repositoryKey, repoUrls } = params;

    if (repositoryKey) {
        const softwareId = await findSoftwareIdByForgeIdentifier({ dbApi, sources, repositoryKey });
        if (softwareId !== undefined) return softwareId;
    }

    for (const repoUrl of repoUrls) {
        const softwareId = await dbApi.softwareExternalData.getSoftwareIdByCodeRepositoryUrl({ repoUrl });
        if (softwareId !== undefined) return softwareId;
    }

    return undefined;
};

const findSoftwareIdByForgeIdentifier = async (params: {
    dbApi: DbApiV2;
    sources: Source[];
    repositoryKey: RepositoryKey;
}): Promise<number | undefined> => {
    const { dbApi, sources, repositoryKey } = params;
    const { origin } = new URL(repositoryKey.url);

    const forgeSource = sources.find(
        source =>
            source.kind === repositoryKey.forgeKind && source.url !== "" && URL.parse(source.url)?.origin === origin
    );

    if (forgeSource) {
        const softwareId = await dbApi.software.getSoftwareIdByExternalIdAndSlug({
            sourceSlug: forgeSource.slug,
            externalId: repositoryKey.externalId,
            ignoreCase: true
        });
        if (softwareId !== undefined) return softwareId;
    }

    const softwareIdByIdentifier = await dbApi.softwareExternalData.getOtherIdentifierIdsBySourceURL({
        sourceURL: forgeSource?.url ?? origin
    });
    if (!softwareIdByIdentifier) return undefined;

    // Identifiers keep the case of the url they were built from.
    const externalId = repositoryKey.externalId.toLowerCase();
    const match = Object.entries(softwareIdByIdentifier).find(([value]) => value.toLowerCase() === externalId);
    return match?.[1];
};

// Spellings under which other sources may cite the repository.
export const getRepoUrlSpellings = (params: { input: string; repository: ResolvedRepository | undefined }) =>
    Array.from(
        new Set(
            [params.input, params.repository?.url]
                .map(url => (url === undefined ? undefined : normalizeRepoUrl(url)))
                .filter(url => url !== undefined)
        )
    );

export const makeResolveRepoUrl =
    (deps: {
        dbApi: DbApiV2;
        resolveRepository: ResolveRepository;
        discoverSourcesByRepository: DiscoverSourcesByRepository;
        fetchDiscoveredSourcesData: FetchDiscoveredSourcesData;
        repositoryCheckCache: RepositoryCheckCache;
    }): ResolveRepoUrl =>
    async ({ url }) => {
        const { dbApi, resolveRepository, discoverSourcesByRepository, fetchDiscoveredSourcesData } = deps;

        const normalizedUrl = normalizeRepoUrl(url);
        if (!normalizedUrl) return { status: "invalid" };

        const sources = await dbApi.source.getAll();
        // A repository found by a previous check is not asked again to the forge.
        const cachedRepository = deps.repositoryCheckCache.get(normalizedUrl)?.repository;
        const resolution: RepositoryResolution = cachedRepository
            ? { status: "found", repository: cachedRepository }
            : await resolveRepository({ url: normalizedUrl, sources });
        const repository = resolution.status === "found" ? resolution.repository : undefined;
        const repoUrl = (resolution.status === "unsupported" ? resolution.url : undefined) ?? normalizedUrl;
        const repoUrls = getRepoUrlSpellings({ input: repoUrl, repository });

        const [discoveredSources, softwareIdByRepository] = await Promise.all([
            discoverSourcesByRepository({ repoUrls, sources }),
            findSoftwareIdByRepository({
                dbApi,
                sources,
                repositoryKey: getRepositoryKey({ resolution, normalizedUrl }),
                repoUrls
            })
        ]);

        // The creation binds what the form shows.
        deps.repositoryCheckCache.set([normalizedUrl, ...repoUrls], { repository, discoveredSources });

        const existingSoftwareId =
            softwareIdByRepository ??
            discoveredSources.find(source => source.existingSoftwareId !== undefined)?.existingSoftwareId;

        const resolved: ResolvedRepoUrl = {
            codeRepositoryUrl: repository?.url ?? repoUrl,
            discoveredSources,
            // A known software can't be created again: no need to show its sources.
            discoveredDataBySource:
                existingSoftwareId === undefined
                    ? await fetchDiscoveredSourcesData({ discoveredSources, sources })
                    : [],
            existingSoftwareId
        };

        switch (resolution.status) {
            case "unsupported":
                return { status: "unsupported", ...resolved };
            case "notFound":
            case "unreachable":
                return { status: resolution.status, forgeKind: resolution.forgeKind, ...resolved };
            case "found":
                return {
                    status: "found",
                    forgeKind: resolution.repository.forgeKind,
                    externalId: resolution.repository.externalId,
                    name: resolution.repository.name,
                    description: resolution.repository.description,
                    license: resolution.repository.license,
                    image: resolution.repository.image,
                    keywords: resolution.repository.keywords,
                    ...resolved
                };
        }
    };
