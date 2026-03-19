// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";

import type { GetSoftwareExternal } from "../../ports/GetSoftwareExternal";
import type { SoftwareExternal } from "../../types/SoftwareTypes";
import { Source } from "../../usecases/readWriteSillData";
import { identifersUtils } from "../../../tools/identifiersTools";
import { repoGitHubEndpointMaker } from "./api/repo";

export const getGitHubSoftwareExternalData: GetSoftwareExternal = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareExternal | undefined> => {
        if (source.kind !== "GitHub") throw new Error("This source if not compatible with GitHub Adapter");
        if (source.url !== "https://github.com/")
            throw new Error("This source doesn't allow custom url, please set it properly.");

        const gitHubApi = repoGitHubEndpointMaker({ source });
        if (!gitHubApi) throw new Error("This GitHub url provided doesn't work.");

        const repoUrl = externalId.includes("https://github.com") ? externalId : `https://github.com/${externalId}`;

        const repoData = await gitHubApi.repo.get({ repoUrl });
        const repoDevs = await gitHubApi.repo.getContributors({ repoUrl });
        const repoTags = await gitHubApi.repo.getTags({ repoUrl });
        const repoLanguages = await gitHubApi.repo.getLanguages({ repoUrl });
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

        const publicationIso = lastVersionCommit?.commit.author?.date
            ? new Date(lastVersionCommit.commit.author.date).toISOString()
            : undefined;
        const nowIso = new Date().toISOString();

        return {
            variant: "external",
            id: undefined,
            externalId: repoData.html_url.replace("https://github.com/", "").replace("git+", "").replace(".git", ""),
            sourceSlug: source.slug,
            authors: filteredUserDevs.map(dev => ({
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
            name: { "en": repoData.full_name },
            description: repoData?.description ? { "en": repoData.description } : {},
            isLibreSoftware: true,
            image: undefined,
            url: repoData.homepage ?? undefined,
            codeRepositoryUrl: repoData.html_url,
            softwareHelp: undefined,
            license: repoData.license?.name,
            latestVersion: repoTags?.[0]?.name ? { version: repoTags[0].name, releaseDate: publicationIso } : undefined,
            dateCreated: publicationIso,
            addedTime: nowIso,
            updateTime: nowIso,
            keywords: repoData.topics ?? [],
            programmingLanguages: Object.keys(repoLanguages),
            applicationCategories: [],
            operatingSystems: { windows: false, linux: false, mac: false, android: false, ios: false },
            runtimePlatforms: [],
            referencePublications: [],
            identifiers: [
                identifersUtils.makeRepoGitHubIdentifer({
                    repoUrl: repoData.html_url,
                    repoId: repoData.id
                })
            ],
            providers: [],
            similarSoftwares: [],
            dereferencing: undefined,
            customAttributes: undefined,
            userAndReferentCountByOrganization: undefined,
            hasExpertReferent: undefined,
            instances: undefined
        };
    }
);
