// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Octokit } from "@octokit/rest";
import { Endpoints } from "@octokit/types";

export namespace GitHubAPI {
    export type Commit = Endpoints["GET /repos/{owner}/{repo}/commits/{ref}"]["response"]["data"];
    export type Repo = Endpoints["GET /repos/{owner}/{repo}"]["response"]["data"];
    export type Contributors = Endpoints["GET /repos/{owner}/{repo}/contributors"]["response"]["data"];
    export type Languages = Endpoints["GET /repos/{owner}/{repo}/languages"]["response"]["data"];
    export type Tags = Endpoints["GET /repos/{owner}/{repo}/tags"]["response"]["data"];
    export type User = Endpoints["GET /user/{account_id}"]["response"]["data"];
    export type SearchRepositories = Endpoints["GET /search/repositories"]["response"]["data"];
    export type SearchRepositoriesItem = Endpoints["GET /search/repositories"]["response"]["data"]["items"][0];
}

const parseURL = (repoUrl: string | URL): { repo: string; owner: string } => {
    let repoUrlObj = typeof repoUrl === "string" ? URL.parse(repoUrl) : repoUrl;
    if (!repoUrlObj) throw Error("The provided URL could be parsed");

    // Case .git at the end
    if (repoUrlObj.pathname.endsWith("/")) repoUrlObj.pathname = repoUrlObj.pathname.slice(0, -1);
    if (repoUrlObj.pathname.endsWith(".git")) repoUrlObj.pathname = repoUrlObj.pathname.slice(0, -4);

    const parsed = repoUrlObj.pathname.split("/").filter(text => text);

    return {
        repo: parsed[1],
        owner: parsed[0]
    };
};

export const repoGitHubEndpointMaker = (params: { githubPersonalAccessTokenForApiRateLimit?: string }) => {
    const { githubPersonalAccessTokenForApiRateLimit } = params;
    const octokit = new Octokit({
        auth: githubPersonalAccessTokenForApiRateLimit
    });

    return {
        repo: {
            issues: {
                getLastClosedIssue: async (params: { repoUrl: string | URL }) => {
                    try {
                        const { owner, repo } = parseURL(params.repoUrl);
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
                getBySha: async (params: {
                    repoUrl: string | URL;
                    commit_sha: string;
                }): Promise<GitHubAPI.Commit | undefined> => {
                    try {
                        const { owner, repo } = parseURL(params.repoUrl);
                        const resCommit = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
                            owner,
                            repo,
                            ref: params.commit_sha,
                            headers: {
                                "X-GitHub-Api-Version": "2022-11-28"
                            },
                            direction: "desc"
                        });
                        return resCommit.data;
                    } catch (error) {
                        return undefined;
                    }
                },
                getLastCommit: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Commit | undefined> => {
                    try {
                        const { owner, repo } = parseURL(params.repoUrl);
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
                getLast: async (params: { repoUrl: string | URL }) => {
                    try {
                        const { owner, repo } = parseURL(params.repoUrl);
                        const resPull = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
                            owner,
                            repo,
                            headers: {
                                "X-GitHub-Api-Version": "2022-11-28"
                            },
                            direction: "desc"
                        });

                        return resPull.data[0];
                    } catch (error) {
                        return undefined;
                    }
                }
            },
            get: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Repo | undefined> => {
                try {
                    const { owner, repo } = parseURL(params.repoUrl);
                    const resPull = await octokit.request("GET /repos/{owner}/{repo}", {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc"
                    });

                    return resPull.data;
                } catch (error) {
                    return undefined;
                }
            },
            getContributors: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Contributors | undefined> => {
                try {
                    const { owner, repo } = parseURL(params.repoUrl);
                    const resPull = await octokit.request("GET /repos/{owner}/{repo}/contributors", {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc"
                    });

                    return resPull.data;
                } catch (error) {
                    return undefined;
                }
            },
            getLanguages: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Languages | undefined> => {
                try {
                    const { owner, repo } = parseURL(params.repoUrl);
                    const resPull = await octokit.request("GET /repos/{owner}/{repo}/languages", {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc"
                    });

                    return resPull.data;
                } catch (error) {
                    return undefined;
                }
            },
            getTags: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Tags | undefined> => {
                try {
                    const { owner, repo } = parseURL(params.repoUrl);
                    const resPull = await octokit.request("GET /repos/{owner}/{repo}/tags", {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc"
                    });

                    return resPull.data;
                } catch (error) {
                    return undefined;
                }
            }
        },
        users: {
            getById: async (account_id: number): Promise<GitHubAPI.User | undefined> => {
                try {
                    const resPull = await octokit.request("GET /user/{account_id}", {
                        account_id,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc",
                        state: "closed"
                    });

                    return resPull.data;
                } catch (error) {
                    return undefined;
                }
            },
            getByUsername: async (username: string): Promise<GitHubAPI.User | undefined> => {
                try {
                    const resPull = await octokit.request("GET /users/{username}", {
                        username,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc",
                        state: "closed"
                    });

                    return resPull.data;
                } catch (error) {
                    return undefined;
                }
            }
        },
        search: {
            repo: {
                searchByName: async (name: string): Promise<GitHubAPI.SearchRepositories | undefined> => {
                    try {
                        const resPull = await octokit.request(`GET /search/repositories?q=${name} in:name`, {
                            headers: {
                                "X-GitHub-Api-Version": "2022-11-28"
                            },
                            direction: "desc"
                        });

                        if (resPull.data.total_count === 0) return undefined;

                        return resPull.data;
                    } catch (error) {
                        return undefined;
                    }
                }
            }
        }
    };
};
