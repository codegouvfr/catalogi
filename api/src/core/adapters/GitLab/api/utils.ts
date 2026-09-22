import type { Gitlab, ProjectSchema } from "@gitbeaker/core";

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

export const resolveExternalReferenceToProject = async (params: {
    externalId: string;
    gitLabApi: Gitlab<false>;
}): Promise<ProjectSchema | undefined> => {
    const { externalId, gitLabApi } = params;
    const baseUrl = gitLabApi.url;

    if (Number.isNaN(externalId)) {
        return withTimeout({
            timeoutMs: 15_000,
            promiseFactory: () => gitLabApi.Projects.show(externalId)
        });
    }

    const externalIdUrl = URL.parse(externalId);
    let pathname = externalId;
    if (externalIdUrl && baseUrl === externalIdUrl.origin) {
        pathname = externalIdUrl.pathname;
    }
    if (pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
    }
    const splited = pathname.split("/");
    if (splited.length > 2) {
        pathname = splited[0] + "/" + splited[1];
    }

    try {
        const project = await withTimeout({
            timeoutMs: 15_000,
            promiseFactory: () => gitLabApi.Projects.show(pathname)
        });
        if (project) {
            if (typeof project === "string") {
                throw new Error(`API Issue on ${baseUrl}`);
            }
            return project;
        }
        return undefined;
    } catch (error) {
        console.error(`Error fetching project ${externalId}:`, error);
        throw error;
    }
};
