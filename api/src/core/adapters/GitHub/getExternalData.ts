// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import { GetSoftwareExternalData, SoftwareExternalData } from "../../ports/GetSoftwareExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { identifersUtils } from "../../../tools/identifiersTools";
import { repoGitHubEndpointMaker } from "./api/repo";

export const getGitHubSoftwareExternalData: GetSoftwareExternalData = memoize(
    async ({
        externalId,
        source
    }: {
        externalId: string;
        source: Source;
    }): Promise<SoftwareExternalData | undefined> => {
        if (source.kind !== "GitHub") throw new Error("This source if not compatible with GitHub Adapter");
        if (source.url !== "https://github.com/")
            throw new Error("This source doesn't allow custom url, please set it properly.");

        const gitHubApi = repoGitHubEndpointMaker({});
        if (!gitHubApi) throw new Error("This GitHub url provided doesn't work.");

        const repoUrl = externalId.includes("https://github.com") ? externalId : `https://github.com/${externalId}`;

        const repoData = await gitHubApi.repo.get({ repoUrl });
        const repoDevs = await gitHubApi.repo.getContributors({ repoUrl });
        const repoTags = await gitHubApi.repo.getTags({ repoUrl });
        const repoLanguages = await gitHubApi.repo.getLanguages({ repoUrl });
        const lastCommit = await gitHubApi.repo.commits.getLastCommit({ repoUrl });
        const lastCloseIssue = await gitHubApi.repo.issues.getLastClosedIssue({ repoUrl });
        const lastClosedPull = await gitHubApi.repo.mergeRequests.getLast({ repoUrl });

        const devIds =
            repoDevs
                ?.map(dev => dev.id)
                .filter(a => {
                    return a !== undefined;
                }) ?? [];

        const userDevs = await Promise.all(devIds.map(devId => gitHubApi.users.getById(devId)));
        const filteredUserDevs = userDevs.filter(a => {
            return a !== undefined;
        });

        if (!repoData || !filteredUserDevs || !repoTags || !repoLanguages) return undefined;

        const versionCommitSha = repoTags?.[0]?.commit?.sha;
        const lastVersionCommit = versionCommitSha
            ? await gitHubApi.repo.commits.getBySha({
                  repoUrl: externalId,
                  commit_sha: versionCommitSha
              })
            : undefined;

        return {
            externalId: repoData.html_url.replace("https://github.com/", "").replace("git+", "").replace(".git", ""),
            sourceSlug: source.slug,
            developers: filteredUserDevs.map(dev => ({
                "@type": "Person",
                name: dev.name ?? dev.login,
                identifiers: [
                    identifersUtils.makeUserGitHubIdentifer({ username: dev.name ?? dev.login, userId: dev.id })
                ],
                url: dev.blog ?? undefined,
                affiliations: dev.company
                    ? [
                          {
                              "@type": "Organization" as const,
                              "name": dev.company
                          }
                      ]
                    : []
            })),
            label: { "en": repoData.full_name },
            description: repoData?.description ? { "en": repoData.description } : {},
            isLibreSoftware: true, // TODO Resolver ?
            logoUrl: undefined,
            websiteUrl: repoData.homepage ?? undefined,
            sourceUrl: repoData.html_url,
            documentationUrl: undefined,
            license: repoData.license?.name,
            softwareVersion: repoTags?.[0]?.name,
            keywords: repoData.topics,
            programmingLanguages: Object.keys(repoLanguages),
            applicationCategories: [],
            publicationTime: lastVersionCommit?.commit.author?.date
                ? new Date(lastVersionCommit.commit.author.date)
                : undefined,
            referencePublications: [],
            identifiers: [
                identifersUtils.makeRepoGitHubIdentifer({
                    repoUrl: repoData.html_url,
                    repoId: repoData.id
                })
            ],
            repoMetadata: {
                healthCheck: {
                    lastCommit: lastCommit?.commit?.author?.date ? new Date(lastCommit.commit.author.date) : undefined,
                    lastClosedIssue: lastCloseIssue?.closed_at ? new Date(lastCloseIssue.closed_at) : undefined,
                    lastClosedIssuePullRequest: lastClosedPull?.closed_at
                        ? new Date(lastClosedPull.closed_at)
                        : undefined
                }
            },
            providers: []
        };
    }
);
