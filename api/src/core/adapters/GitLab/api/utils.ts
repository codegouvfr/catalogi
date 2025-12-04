import type { Gitlab, ProjectSchema } from "@gitbeaker/core";

export const repoUrlToAPIUrl = (projectUrl: string | URL): string => {
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

    if (typeof Number(externalId) === "number") {
        return gitLabApi.Projects.show(externalId);
    }

    const baseUrl = gitLabApi.url;

    if (externalId.includes("https://")) {
        const projectName = externalId.replace(baseUrl, "");
        const projects = await gitLabApi.Projects.all({ search: projectName });

        // Multiples
        // One
        // None

        return projects[0];
    }

    // This may be a project name
    if (externalId.includes("/")) {
        const projects = await gitLabApi.Projects.all({ search: externalId });

        // Multiples
        // One
        // None

        return projects[0];
    }

    return undefined;
};
