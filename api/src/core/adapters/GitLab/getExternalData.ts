// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { Gitlab } from "@gitbeaker/rest";

import { GetSoftwareExternalData, SoftwareExternalData } from "../../ports/GetSoftwareExternalData";
import { Source } from "../../usecases/readWriteSillData";
import { identifersUtils } from "../../../tools/identifiersTools";
import { resolveExternalReferenceToProject } from "./api/utils";

export const getGitLabSoftwareExternalData: GetSoftwareExternalData = memoize(
    async ({
        externalId,
        source
    }: {
        externalId: string;
        source: Source;
    }): Promise<SoftwareExternalData | undefined> => {
        if (source.kind !== "GitLab") throw new Error("This source if not compatible with GitLab Adapter");

        const api = new Gitlab({
            host: source.url
        });

        const project = await resolveExternalReferenceToProject({ externalId, gitLabApi: api });
        if (!project) return;

        const releases = await api.ProjectReleases.all(project.id, { sort: "desc" });
        const lastRelease = releases[0];

        const members = await api.ProjectMembers.all(project.id);

        const lastMergedRequest = (
            await api.MergeRequests.all({ projectId: project.id, sort: "desc", state: "closed" })
        )[0];
        const lastCommit = (await api.Commits.all(project.id))[0];
        const lastCloseIssue = (await api.Issues.all({ projectId: project.id, sort: "desc", state: "closed" }))[0];

        return {
            externalId,
            sourceSlug: source.slug,
            developers: members
                .filter(member => member.access_level >= 30)
                .map(member => ({
                    "@type": "Person",
                    name: member.name ?? member.username,
                    identifiers: [
                        identifersUtils.makeUserGitLabIdentifer({
                            username: member.username,
                            userId: member.id,
                            gitLabUrl: source.url
                        })
                    ],
                    url: member.web_url ?? undefined,
                    affiliations: []
                })),
            label: { "en": project.name },
            description: project?.description ? { "en": project.description } : {},
            isLibreSoftware: true, // TODO Resolver ?
            logoUrl: project.avatar_url ?? undefined,
            websiteUrl: undefined,
            sourceUrl: project.web_url,
            documentationUrl: project.readme_url,
            license: project.license?.name,
            softwareVersion: lastRelease.tag_name,
            keywords: project.topics ?? undefined,
            programmingLanguages: [], // TODO
            applicationCategories: [],
            publicationTime: lastRelease.released_at ? new Date(lastRelease.released_at) : undefined,
            referencePublications: [],
            identifiers: [
                identifersUtils.makeRepoGitLabIdentifer({
                    gitLabUrl: source.url,
                    projectId: project.id,
                    projectName: project.path_with_namespace
                })
            ],
            repoMetadata: {
                healthCheck: {
                    lastCommit: lastCommit?.committed_date ? new Date(lastCommit.committed_date) : undefined,
                    lastClosedIssue: lastCloseIssue?.closed_at ? new Date(lastCloseIssue.closed_at) : undefined,
                    lastClosedIssuePullRequest: lastMergedRequest?.closed_at
                        ? new Date(lastMergedRequest.closed_at)
                        : undefined
                }
            },
            providers: []
        };
    }
);
