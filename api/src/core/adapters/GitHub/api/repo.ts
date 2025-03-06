import { Octokit } from "@octokit/rest";

import { env } from "../../../../env";

export const repoGitHubEndpointMaker = (repoUrl: string | URL) => {
    const octokit = new Octokit({
        auth: env.githubPersonalAccessTokenForApiRateLimit
    });
    let repoUrlObj = typeof repoUrl === "string" ? URL.parse(repoUrl) : repoUrl;
    if (!repoUrlObj) return undefined;

    // Case .git at the end
    if (repoUrlObj.pathname.endsWith("/")) repoUrlObj.pathname = repoUrlObj.pathname.slice(0, -1);
    if (repoUrlObj.pathname.endsWith(".git")) repoUrlObj.pathname = repoUrlObj.pathname.slice(0, -4);

    const parsed = repoUrlObj.pathname.split("/").filter(text => text);

    const repo = parsed[1];
    const owner = parsed[0];

    return {
        issues: {
            getLastClosedIssue: async () => {
                try {
                    const resIssues = await octokit.request("GET /repos/{owner}/{repo}/issues", {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc",
                        state: "closed"
                    });

                    return resIssues.data[0];
                } catch (error) {
                    return undefined;
                }
            }
        },
        commits: {
            getLastCommit: async () => {
                try {
                    const resCommit = await octokit.request("GET /repos/{owner}/{repo}/commits", {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc"
                    });
                    return resCommit.data[0];
                } catch (error) {
                    return undefined;
                }
            }
        },
        mergeRequests: {
            getLast: async () => {
                try {
                    const resPull = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc",
                        state: "closed"
                    });

                    return resPull.data[0];
                } catch (error) {
                    return undefined;
                }
            }
        }
    };
};
