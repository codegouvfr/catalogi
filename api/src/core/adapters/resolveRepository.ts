// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Gitlab } from "@gitbeaker/rest";
import type { RepositoryResolution, ResolveRepository } from "../ports/ResolveRepository";
import type { Source } from "../usecases/readWriteSillData";
import { repoAnalyser } from "../../tools/repoAnalyser";
import { Octokit } from "@octokit/rest";
import { makeTtlCache } from "../../tools/ttlCache";

const gitHubOrigin = "https://github.com";

// Accepts what people usually paste: clone urls (`git+`, `.git`, ssh) and links to a
// sub-page of the repository. Returns the repository url without trailing slash.
export const normalizeRepoUrl = (input: string): string | undefined => {
    let value = input.trim();
    if (value.startsWith("git+")) value = value.slice(4);

    const ssh = /^git@([^:/]+):(.+)$/.exec(value);
    if (ssh) value = `https://${ssh[1]}/${ssh[2]}`;

    const url = URL.parse(value);
    if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return undefined;

    // `www.github.com` and `http://github.com` redirect to the same repository.
    const origin = url.hostname === "github.com" || url.hostname === "www.github.com" ? gitHubOrigin : url.origin;

    // GitLab sub-pages all live under `/-/`.
    let pathname = url.pathname
        .split("/-/")[0]
        .replace(/\/+$/, "")
        .replace(/\.git$/, "");

    if (origin === gitHubOrigin) {
        const segments = pathname.split("/").filter(segment => segment);
        pathname = "/" + segments.slice(0, 2).join("/");
    }

    if (pathname === "" || pathname === "/") return undefined;

    return `${origin}${pathname}`;
};

// Sub-pages of the forges not handled here (Forgejo, Gitea, Bitbucket, SourceHut...),
// which all address a repository as `owner/repo`.
const forgeSubPages = new Set([
    "src",
    "tree",
    "blob",
    "raw",
    "blame",
    "commits",
    "commit",
    "log",
    "refs",
    "branches",
    "tags",
    "releases",
    "downloads",
    "issues",
    "pulls",
    "pull-requests",
    "wiki",
    "actions",
    "activity",
    "milestones",
    "labels",
    "projects",
    "packages",
    "archive",
    "compare"
]);

// Only applied to unsupported forges: GitLab groups nest, so a third segment
// may be a group or a project there.
export const stripForgeSubPage = (repoUrl: string): string => {
    const url = new URL(repoUrl);
    const segments = url.pathname.split("/").filter(segment => segment);
    if (segments.length <= 2 || !forgeSubPages.has(segments[2].toLowerCase())) return repoUrl;
    return `${url.origin}/${segments.slice(0, 2).join("/")}`;
};

const findSourceByOrigin = (sources: Source[], kind: Source["kind"], origin: string) =>
    sources.find(source => source.kind === kind && source.url !== "" && URL.parse(source.url)?.origin === origin);

// A missing repository answers 404; anything else (rate limit, timeout...) says nothing about it.
// GitHub answers 403 when the rate limit is exceeded.
const getErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || error === null) return undefined;
    if ("status" in error && typeof error.status === "number") return error.status;
    // Gitbeaker keeps the fetch response in `cause`.
    const response = "cause" in error ? (error.cause as { response?: { status?: unknown } })?.response : undefined;
    return typeof response?.status === "number" ? response.status : undefined;
};

const resolveGitHubRepository = async (url: string, sources: Source[]): Promise<RepositoryResolution> => {
    const source = findSourceByOrigin(sources, "GitHub", gitHubOrigin);
    const octokit = new Octokit(source?.configuration?.auth ? { auth: source.configuration.auth } : {});

    // Organization urls have a single path segment.
    const [owner, repoName] = new URL(url).pathname.split("/").filter(segment => segment);
    if (repoName === undefined) return { status: "notFound", forgeKind: "GitHub" };

    let repo;
    try {
        repo = (await octokit.request("GET /repos/{owner}/{repo}", { owner, repo: repoName })).data;
    } catch (error) {
        console.info(`[resolveRepository] GitHub repository ${url} not readable: ${String(error)}`);
        return { status: getErrorStatus(error) === 404 ? "notFound" : "unreachable", forgeKind: "GitHub" };
    }

    const license = repo.license?.spdx_id;

    return {
        status: "found",
        repository: {
            forgeKind: "GitHub",
            url: repo.html_url,
            externalId: repo.html_url.replace(`${gitHubOrigin}/`, ""),
            name: repo.name,
            description: repo.description ?? undefined,
            license: license && license !== "NOASSERTION" ? license : undefined,
            image: repo.owner.avatar_url,
            keywords: repo.topics ?? []
        }
    };
};

const resolveGitLabRepository = async (url: string, sources: Source[]): Promise<RepositoryResolution> => {
    const { origin, pathname } = new URL(url);
    const source = findSourceByOrigin(sources, "GitLab", origin);

    const gitLabApi = new Gitlab({
        host: origin,
        queryTimeout: source?.configuration?.queryTimeout ?? 15_000,
        ...(source?.configuration?.auth ? { token: source.configuration.auth } : {})
    });

    const projectPath = pathname.substring(1);
    const projectNotFound = new Error(`no project matching ${projectPath}`);

    // Some instances sit behind a proxy rejecting encoded slashes in project paths
    // (gitlab.adullact.net): find the project id through the search instead.
    const findProjectId = async (): Promise<number | string> => {
        try {
            return (await gitLabApi.Projects.show(projectPath)).id;
        } catch (error) {
            // A forge not answering would not answer the search either.
            const status = getErrorStatus(error);
            if (status === undefined || status === 429 || status >= 500) throw error;
            const candidates = await gitLabApi.Projects.all({
                search: projectPath.split("/").at(-1),
                perPage: 100,
                maxPages: 1
            });
            const match = candidates.find(
                candidate => candidate.path_with_namespace.toLowerCase() === projectPath.toLowerCase()
            );
            if (!match) throw projectNotFound;
            return match.id;
        }
    };

    try {
        const project = await gitLabApi.Projects.show(await findProjectId(), { license: true });

        return {
            status: "found",
            repository: {
                forgeKind: "GitLab",
                url: project.web_url,
                externalId: project.id.toString(),
                name: project.name,
                description: project.description || undefined,
                license: project.license?.name,
                image: project.avatar_url ?? undefined,
                keywords: project.topics ?? []
            }
        };
    } catch (error) {
        console.info(`[resolveRepository] GitLab project ${url} not readable: ${String(error)}`);
        const isNotFound = error === projectNotFound || getErrorStatus(error) === 404;
        return { status: isNotFound ? "notFound" : "unreachable", forgeKind: "GitLab" };
    }
};

export const resolveRepository: ResolveRepository = async ({ url, sources }) => {
    const normalizedUrl = normalizeRepoUrl(url);
    if (!normalizedUrl) return { status: "unsupported", url: undefined };

    const { origin } = new URL(normalizedUrl);

    // Registered instances skip the forge detection request.
    const forgeKind =
        origin === gitHubOrigin
            ? "GitHub"
            : findSourceByOrigin(sources, "GitLab", origin)
              ? "GitLab"
              : await repoAnalyser(normalizedUrl);

    switch (forgeKind) {
        case "GitHub":
            return resolveGitHubRepository(normalizedUrl, sources);
        case "GitLab":
            return resolveGitLabRepository(normalizedUrl, sources);
        default:
            return { status: "unsupported", url: stripForgeSubPage(normalizedUrl) };
    }
};

// The form checks the url, then the creation resolves it again: the cache keeps both
// consistent and spares the forge quotas. A missing repository may be published
// meanwhile and a forge not answering may come back: both are asked again.
export const makeCachedResolveRepository = (params: {
    resolveRepository: ResolveRepository;
    ttlMs?: number;
}): ResolveRepository => {
    const { resolveRepository, ttlMs = 15 * 60_000 } = params;
    const cache = makeTtlCache<RepositoryResolution>({ ttlMs });

    return async ({ url, sources }) => {
        const key = normalizeRepoUrl(url) ?? url;
        const cached = cache.get(key);
        if (cached) return cached;

        const resolution = await resolveRepository({ url, sources });
        if (resolution.status === "found" || resolution.status === "unsupported") cache.set(key, resolution);
        return resolution;
    };
};
