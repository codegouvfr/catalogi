// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Octokit } from "@octokit/rest";
import { Endpoints, RequestParameters } from "@octokit/types";
import { USER_ARGENT } from "../../../../tools/sourceConfig";

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

const GITHUB_API_API_TIMEOUT = 60 * 1000;
const GITHUB_API_LOG = "[GitHubAdapter]";

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

export const gitHubEndpointMaker = (params?: { auth?: string; userAgent?: string }) => {
    const octokit = new Octokit({
        auth: params?.auth,
        userAgent: params?.userAgent ?? USER_ARGENT
    });

    const apiCall = async (url: string, options: RequestParameters) => {
        try {
            const resultApi = await octokit.request(url, options);

            if (resultApi.status === 429 || resultApi.status > 500) {
                console.debug(`${GITHUB_API_LOG} Got ${resultApi.status} let's take a break for 60s`);
                await new Promise(resolve => setTimeout(resolve, GITHUB_API_API_TIMEOUT));
                return apiCall(url, options);
            }

            const remainingRequests = parseInt(resultApi.headers["x-ratelimit-remaining"] || "0");
            if (remainingRequests < 15) {
                const now = new Date().valueOf();
                const resetTime = parseInt(resultApi.headers["x-ratelimit-reset"] || "0") * 1000; // Convert to ms
                const timeToWait = resetTime - now;
                console.debug(
                    `${GITHUB_API_LOG} Got ${resultApi.status} let's take a break for ${Math.round(timeToWait / 1000)}s`
                );
                await new Promise(resolve => setTimeout(resolve, timeToWait));
                return apiCall(url, options);
            }

            return resultApi.data;
        } catch (error) {
            console.error(error);
            return undefined;
        }
    };

    return {
        repo: {
            issues: {
                getLastClosedIssue: async (params: { repoUrl: string | URL }) => {
                    const { owner, repo } = parseURL(params.repoUrl);
                    const url = "GET /repos/{owner}/{repo}/issues";
                    const data = await apiCall(url, {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc",
                        state: "closed"
                    });
                    return data[0];
                }
            },
            commits: {
                getBySha: async (params: {
                    repoUrl: string | URL;
                    commit_sha: string;
                }): Promise<GitHubAPI.Commit | undefined> => {
                    const { owner, repo } = parseURL(params.repoUrl);
                    const url = "GET /repos/{owner}/{repo}/commits/{ref}";
                    const data = await apiCall(url, {
                        owner,
                        repo,
                        ref: params.commit_sha,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc"
                    });
                    return data[0];
                },
                getLastCommit: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Commit | undefined> => {
                    const { owner, repo } = parseURL(params.repoUrl);
                    const url = "GET /repos/{owner}/{repo}/commits";
                    const data = await apiCall(url, {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc"
                    });
                    return data[0];
                }
            },
            mergeRequests: {
                getLast: async (params: { repoUrl: string | URL }) => {
                    const { owner, repo } = parseURL(params.repoUrl);
                    const url = "GET /repos/{owner}/{repo}/pulls";
                    const data = await apiCall(url, {
                        owner,
                        repo,
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc",
                        state: "closed"
                    });
                    return data[0];
                }
            },
            get: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Repo | undefined> => {
                const { owner, repo } = parseURL(params.repoUrl);
                const url = "GET /repos/{owner}/{repo}";
                return apiCall(url, {
                    owner,
                    repo,
                    headers: {
                        "X-GitHub-Api-Version": "2022-11-28"
                    }
                });
            },
            getContributors: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Contributors | undefined> => {
                const { owner, repo } = parseURL(params.repoUrl);
                const url = "GET /repos/{owner}/{repo}/contributors";
                return apiCall(url, {
                    owner,
                    repo,
                    headers: {
                        "X-GitHub-Api-Version": "2022-11-28"
                    },
                    direction: "desc"
                });
            },
            getLanguages: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Languages | undefined> => {
                const { owner, repo } = parseURL(params.repoUrl);
                const url = "GET /repos/{owner}/{repo}/languages";
                return apiCall(url, {
                    owner,
                    repo,
                    headers: {
                        "X-GitHub-Api-Version": "2022-11-28"
                    },
                    direction: "desc"
                });
            },
            getTags: async (params: { repoUrl: string | URL }): Promise<GitHubAPI.Tags | undefined> => {
                const { owner, repo } = parseURL(params.repoUrl);
                const url = "GET /repos/{owner}/{repo}/tags";
                return apiCall(url, {
                    owner,
                    repo,
                    headers: {
                        "X-GitHub-Api-Version": "2022-11-28"
                    },
                    direction: "desc"
                });
            }
        },
        users: {
            getById: async (account_id: number): Promise<GitHubAPI.User | undefined> => {
                const url = "GET /user/{account_id}";
                return apiCall(url, {
                    account_id,
                    headers: {
                        "X-GitHub-Api-Version": "2022-11-28"
                    },
                    direction: "desc",
                    state: "closed"
                });
            },
            getByUsername: async (username: string): Promise<GitHubAPI.User | undefined> => {
                const url = "GET /user/{username}";
                return apiCall(url, {
                    username,
                    headers: {
                        "X-GitHub-Api-Version": "2022-11-28"
                    },
                    direction: "desc",
                    state: "closed"
                });
            }
        },
        search: {
            repo: {
                searchByName: async (name: string): Promise<GitHubAPI.SearchRepositories | undefined> => {
                    const url = `GET /search/repositories?q=${name} in:name`;
                    const data = await apiCall(url, {
                        headers: {
                            "X-GitHub-Api-Version": "2022-11-28"
                        },
                        direction: "desc"
                    });

                    if (data.total_count === 0) return undefined;

                    return data;
                }
            }
        }
    };
};
