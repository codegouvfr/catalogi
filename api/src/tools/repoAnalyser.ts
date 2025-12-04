// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Gitlab } from "@gitbeaker/rest";
import { SchemaIdentifier } from "../core/adapters/dbApi/kysely/kysely.database";
import { repoGitHubEndpointMaker } from "../core/adapters/GitHub/api/repo";
import { identifersUtils } from "./identifiersTools";
import { repoUrlToCleanUrl, resolveExternalReferenceToProject } from "../core/adapters/GitLab/api/utils";

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

export const repoUrlToIdentifer = async (params: {
    repoUrl: string | URL | undefined;
}): Promise<SchemaIdentifier | undefined> => {
    const { repoUrl } = params;
    if (!repoUrl) return;

    const repoType = await repoAnalyser(repoUrl);
    switch (repoType) {
        case "GitHub":
            const api = repoGitHubEndpointMaker();
            const repo = await api.repo.get({ repoUrl });

            if (!repo) return;

            return identifersUtils.makeRepoGitHubIdentifer({
                repoUrl: repoUrl.toString(),
                repoId: repo.id
            });
        case "GitLab":
            const clean = repoUrlToCleanUrl(repoUrl);
            const parsedUrl = new URL(clean);
            const gitLabApi = new Gitlab({
                host: parsedUrl.origin
            });

            const externalId = parsedUrl.pathname?.substring(1);
            if (!externalId || externalId === "") return;

            const project = await resolveExternalReferenceToProject({ gitLabApi, externalId });
            if (!project) return;

            return identifersUtils.makeRepoGitLabIdentifer({
                gitLabUrl: parsedUrl.origin,
                projectId: project.id,
                projectName: project.path_with_namespace
            });

        default:
            console.info("This type repo is unkown or not supported.");
            return undefined;
    }
};
