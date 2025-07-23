import { CommitSchema, IssueSchema, MergeRequestSchema } from "@gitbeaker/core";
import { repoUrlToAPIUrl } from "./utils";

const getApiCallTakeFirst = async <T>(url: string): Promise<T | undefined> => {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(10000)
    }).catch(err => {
        console.error(url, err);
    });

    if (!res) {
        return undefined;
    }
    if (res.status === 404) {
        console.error("Ressource not available");
        return undefined;
    }
    if (res.status === 403) {
        console.info(`You don't seems to be allowed on ${url}`);
        return undefined;
    }

    const result: T[] = await res.json();

    return result[0];
};

const getLastClosedIssue = async (projectUrl: string) => {
    return getApiCallTakeFirst<IssueSchema>(`${projectUrl}/issues?sort=desc&state=closed`);
};

const getLastCommit = async (projectUrl: string) => {
    return getApiCallTakeFirst<CommitSchema>(`${projectUrl}/repository/commits?sort=desc`);
};

const getLastMergeRequest = async (projectUrl: string) => {
    return getApiCallTakeFirst<MergeRequestSchema>(`${projectUrl}/merge_requests?state=closed&sort=desc`);
};

export const projectGitLabApiMaker = (repoUrl: string | URL) => {
    const apiProjectEndpoint = repoUrlToAPIUrl(repoUrl);

    return {
        issues: {
            getLastClosedIssue: () => getLastClosedIssue(apiProjectEndpoint)
        },
        commits: {
            getLastCommit: () => getLastCommit(apiProjectEndpoint)
        },
        mergeRequests: {
            getLast: () => getLastMergeRequest(apiProjectEndpoint)
        }
    };
};
