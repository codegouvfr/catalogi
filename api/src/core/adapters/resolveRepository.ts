// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Gitlab } from "@gitbeaker/rest";
import type { RepositoryResolution, ResolveRepository } from "../ports/ResolveRepository";
import type { Source } from "../usecases/readWriteSillData";
import { repoAnalyser } from "../../tools/repoAnalyser";
import { gitHubEndpointMaker } from "./GitHub/api/repo";

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

    // GitLab sub-pages all live under `/-/`.
    let pathname = url.pathname
        .split("/-/")[0]
        .replace(/\/+$/, "")
        .replace(/\.git$/, "");

    if (url.origin === gitHubOrigin) {
        const segments = pathname.split("/").filter(segment => segment);
        pathname = "/" + segments.slice(0, 2).join("/");
    }

    if (pathname === "" || pathname === "/") return undefined;

    return `${url.origin}${pathname}`;
};

const findSourceByOrigin = (sources: Source[], kind: Source["kind"], origin: string) =>
    sources.find(source => source.kind === kind && source.url !== "" && URL.parse(source.url)?.origin === origin);

const resolveGitHubRepository = async (url: string, sources: Source[]): Promise<RepositoryResolution> => {
    const source = findSourceByOrigin(sources, "GitHub", gitHubOrigin);
    const gitHubApi = gitHubEndpointMaker(source?.configuration?.auth ? { auth: source.configuration.auth } : {});

    // Organization urls have a single path segment.
    if (new URL(url).pathname.split("/").filter(segment => segment).length < 2)
        return { status: "notFound", forgeKind: "GitHub" };

    const repo = await gitHubApi.repo.get({ repoUrl: url });
    if (!repo) return { status: "notFound", forgeKind: "GitHub" };

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

    // Some instances sit behind a proxy rejecting encoded slashes in project paths
    // (gitlab.adullact.net): find the project id through the search instead.
    const findProjectId = async (): Promise<number | string> => {
        try {
            return (await gitLabApi.Projects.show(projectPath)).id;
        } catch {
            const candidates = await gitLabApi.Projects.all({
                search: projectPath.split("/").at(-1),
                perPage: 100,
                maxPages: 1
            });
            const match = candidates.find(
                candidate => candidate.path_with_namespace.toLowerCase() === projectPath.toLowerCase()
            );
            if (!match) throw new Error(`no project matching ${projectPath}`);
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
        return { status: "notFound", forgeKind: "GitLab" };
    }
};

export const resolveRepository: ResolveRepository = async ({ url, sources }) => {
    const normalizedUrl = normalizeRepoUrl(url);
    if (!normalizedUrl) return { status: "unsupported" };

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
            return { status: "unsupported" };
    }
};
