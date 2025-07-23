export type RepoType = "GitHub" | "GitLab";

export const repoAnalyser = async (url: string | URL | undefined): Promise<RepoType | undefined> => {
    if (!url) return undefined;

    const urlObj = typeof url === "string" ? URL.parse(url.substring(0, 4) === "git+" ? url.substring(4) : url) : url;

    if (!urlObj) {
        return undefined;
    }

    if (urlObj.origin === "https://github.com") {
        return "GitHub";
    }

    const urlToGitLab = `${urlObj.origin}/api/v4/metadata`;
    const res = await fetch(urlToGitLab, {
        signal: AbortSignal.timeout(10000)
    }).catch(err => {
        console.error(url, err);
    });

    if (res && res.headers && res.headers.has("x-gitlab-meta")) {
        return "GitLab";
    }

    return undefined;
};
