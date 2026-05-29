// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { SoftwareFormData, Source } from "../../usecases/readWriteSillData";
import { resolveOsAndPlatforms } from "../../utils";
import { gitHubEndpointMaker } from "./api/repo";

import memoize from "memoizee";

export const getGitHubSoftwareFOrm: GetSoftwareFormData = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareFormData | undefined> => {
        if (source.kind !== "GitHub") throw new Error("This source if not compatible with GitHub Adapter");
        if (source.url !== "https://github.com/")
            throw new Error("This source doesn't allow custom url, please set it properly.");

        const configApi = source?.configuration?.auth ? { auth: source?.configuration?.auth } : {};
        const gitHubApi = gitHubEndpointMaker(configApi);

        const repoData = await gitHubApi.repo.get({ repoUrl: externalId });
        if (!repoData) throw new Error(`This GitHub url (${externalId}) provided doesn't work.`);

        const formData: SoftwareFormData = {
            name: repoData.full_name,
            nameOverride: null,
            description: null,
            ...resolveOsAndPlatforms(repoData.topics ?? []), // Someting else to rely on ?
            externalIdForSource: repoData.html_url
                .replace("https://github.com/", "")
                .replace("git+", "")
                .replace(".git", ""),
            sourceSlug: source.slug,
            license: null,
            similarSoftwareExternalDataItems: [],
            image: null,
            keywords: repoData.topics || [],
            customAttributes: undefined,
            isLibreSoftware: null,
            url: null,
            codeRepositoryUrl: null,
            softwareHelp: null,
            latestVersion: null
        };

        return formData;
    }
);
