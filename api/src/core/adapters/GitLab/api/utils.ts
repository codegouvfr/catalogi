import type { Gitlab, ProjectSchema } from "@gitbeaker/core";

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

    if (Number.isNaN(externalId)) {
        return gitLabApi.Projects.show(externalId);
    }

    const baseUrl = gitLabApi.url;

    const searchCriteria = externalId.includes("https://")
        ? externalId.replace(baseUrl, "")
        : externalId.includes("/")
          ? externalId.split("/")[1]
          : undefined;

    if (searchCriteria) {
        try {
            const projects = await gitLabApi.Projects.all({ search: searchCriteria });

            // Id not found
            if (projects.length === 0) return undefined;

            // TODO Multiples
            if (projects.length > 1) {
                console.warn(`TODO : ${externalId} research have mutiple results, it should be more precise.`);
            }

            // One
            return projects[0];
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    return undefined;
};
