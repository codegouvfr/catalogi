// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { SoftwareFormData, Source } from "../../usecases/readWriteSillData";
import { resolveSoftwareType } from "../../utils";
import { repoGitHubEndpointMaker } from "./api/repo";

import memoize from "memoizee";

export const getGitHubSoftwareFOrm: GetSoftwareFormData = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareFormData | undefined> => {
        if (source.kind !== "GitHub") throw new Error("This source if not compatible with GitHub Adapter");
        if (source.url !== "https://github.com/")
            throw new Error("This source doesn't allow custom url, please set it properly.");

        const gitHubApi = repoGitHubEndpointMaker();

        const repoData = await gitHubApi.repo.get({ repoUrl: externalId });
        if (!repoData) throw new Error(`This GitHub url (${externalId}) provided doesn't work.`);

        const formData: SoftwareFormData = {
            softwareName: repoData.full_name,
            softwareDescription: repoData?.description ? repoData.description : "",
            softwareType: resolveSoftwareType(repoData.topics ?? []), // Someting else to rely on ?
            externalIdForSource: repoData.html_url
                .replace("https://github.com/", "")
                .replace("git+", "")
                .replace(".git", ""),
            sourceSlug: source.slug,
            softwareLicense: repoData.license?.name ?? "undefined", // TODO 1 case to copyright
            softwareMinimalVersion: undefined,
            similarSoftwareExternalDataItems: [],
            softwareLogoUrl: undefined,
            softwareKeywords: repoData.topics || [],
            customAttributes: undefined
        };

        return formData;
    }
);
