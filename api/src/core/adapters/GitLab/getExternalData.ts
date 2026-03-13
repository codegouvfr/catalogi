// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { Gitlab } from "@gitbeaker/rest";

import type { GetSoftwareExternal } from "../../ports/GetSoftwareExternal";
import type { SoftwareExternal } from "../../types/SoftwareTypes";
import { Source } from "../../usecases/readWriteSillData";
import { identifersUtils } from "../../../tools/identifiersTools";
import { resolveExternalReferenceToProject } from "./api/utils";

export const getGitLabSoftwareExternalData: GetSoftwareExternal = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareExternal | undefined> => {
        if (source.kind !== "GitLab") throw new Error("This source if not compatible with GitLab Adapter");

        const api = new Gitlab({
            host: source.url
        });

        const project = await resolveExternalReferenceToProject({ externalId, gitLabApi: api });
        if (!project) return;

        const releases = await api.ProjectReleases.all(project.id, { sort: "desc" });
        const lastRelease = releases[0];

        const members = await api.ProjectMembers.all(project.id);

        const publicationIso = lastRelease?.released_at ? new Date(lastRelease.released_at).toISOString() : undefined;
        const nowIso = new Date().toISOString();

        return {
            variant: "external",
            id: undefined,
            externalId,
            sourceSlug: source.slug,
            authors: members
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
            name: { "en": project.name },
            description: project?.description ? { "en": project.description } : {},
            isLibreSoftware: true,
            image: project.avatar_url ?? undefined,
            url: undefined,
            codeRepositoryUrl: project.web_url,
            softwareHelp: project.readme_url ?? undefined,
            license: project.license?.name,
            latestVersion: lastRelease?.tag_name
                ? { version: lastRelease.tag_name, releaseDate: publicationIso }
                : undefined,
            dateCreated: publicationIso,
            addedTime: nowIso,
            updateTime: nowIso,
            keywords: project.topics ?? [],
            programmingLanguages: [],
            applicationCategories: [],
            operatingSystems: { windows: false, linux: false, mac: false, android: false, ios: false },
            runtimePlatforms: [],
            referencePublications: [],
            identifiers: [
                identifersUtils.makeRepoGitLabIdentifer({
                    gitLabUrl: source.url,
                    projectId: project.id,
                    projectName: project.path_with_namespace
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
