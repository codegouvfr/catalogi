import type { Gitlab, ProjectSchema } from "@gitbeaker/core";
import { GitbeakerRequestError } from "@gitbeaker/requester-utils";

const withTimeout = async <T>(params: { timeoutMs: number; promiseFactory: () => Promise<T> }): Promise<T> => {
    const { timeoutMs, promiseFactory } = params;

    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promiseFactory(), timeoutPromise]);
};

export const repoUrlToCleanUrl = (projectUrl: string | URL): string => {
    let url = projectUrl;

    if (typeof url === "string") {
        // Case git+ at the beging
        if (url.startsWith("git+")) url = url.substring(4);

        // Case ssh protocol
        if (url.startsWith("git@")) url = url.replace(":", "/").replace("git@", "https://");

        // Case .git at the end
        if (url.endsWith(".git")) url = url.slice(0, -4);
    }

    const urlObj = typeof projectUrl === "string" ? URL.parse(url) : projectUrl;

    if (url === "" || !urlObj) {
        throw new Error("Bad URL");
    }

    return urlObj.toString();
};

export const repoUrlToAPIUrl = (projectUrl: string | URL): string => {
    const urlObj = URL.parse(projectUrl);

    if (!urlObj) {
        throw new Error("Bad URL");
    }

    const base = urlObj.origin;

    let projectPath = urlObj.pathname.substring(1);
    if (projectPath.includes("/-/")) projectPath = projectPath.split("-")[0];
    // Case / at the end
    if (projectPath.endsWith("/")) projectPath = projectPath.slice(0, -1);
    projectPath = projectPath.replaceAll("/", "%2F");

    return `${base}/api/v4/projects/${projectPath}`;
};

export const getGitLabErrorStatus = (error: unknown): number | undefined =>
    error instanceof GitbeakerRequestError ? error.cause?.response?.status : undefined;

const toProjectPaths = (externalId: string, apiUrl: string): string[] => {
    const externalIdUrl = URL.parse(externalId);
    const instancePath = externalIdUrl?.origin === URL.parse(apiUrl)?.origin ? externalIdUrl?.pathname : undefined;
    const path = (instancePath ?? externalId)
        .split("/-/")[0]
        .replace(/^\/+|\/+$/g, "")
        .replace(/\.git$/, "");
    if (path === "") return [];

    const segments = path.split("/");
    return segments.length > 2 ? [path, segments.slice(0, 2).join("/")] : [path];
};

const showFirstExistingProject = async (
    gitLabApi: Gitlab<false>,
    [path, ...nextPaths]: string[]
): Promise<ProjectSchema | undefined> => {
    if (path === undefined) return undefined;

    try {
        const project = await withTimeout({
            timeoutMs: 15_000,
            promiseFactory: () => gitLabApi.Projects.show(path)
        });
        if (typeof project === "string") throw new Error(`API Issue on ${gitLabApi.url}`);
        return project;
    } catch (error) {
        if (getGitLabErrorStatus(error) !== 404 || nextPaths.length === 0) throw error;
        return showFirstExistingProject(gitLabApi, nextPaths);
    }
};

export const resolveExternalReferenceToProject = async (params: {
    externalId: string;
    gitLabApi: Gitlab<false>;
}): Promise<ProjectSchema | undefined> => {
    const { externalId, gitLabApi } = params;
    return showFirstExistingProject(gitLabApi, toProjectPaths(externalId, gitLabApi.url));
};
