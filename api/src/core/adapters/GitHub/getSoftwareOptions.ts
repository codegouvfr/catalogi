// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type {
    GetSoftwareExternalDataOptions,
    SoftwareExternalDataOption
} from "../../ports/GetSoftwareExternalDataOptions";
import { Source } from "../../usecases/readWriteSillData";
import { GitHubAPI, repoGitHubEndpointMaker } from "./api/repo";

const gitHubSoftwareToExternalOption =
    ({ source }: { source: Source }) =>
    (gitHubItem: GitHubAPI.SearchRepositoriesItem): SoftwareExternalDataOption => {
        return {
            externalId: gitHubItem.html_url,
            label: gitHubItem.name,
            description: gitHubItem.description ?? "",
            isLibreSoftware: false,
            sourceSlug: source.slug
        };
    };

export const getGitHubSoftwareOptions: GetSoftwareExternalDataOptions = async ({ queryString, language, source }) => {
    if (source.kind !== "GitHub") throw new Error(`Not a GitHub source, was : ${source.kind}`);
    console.debug(`GitHub doesn't support multi languages, ${language} not used`);

    if (source.kind !== "GitHub") throw new Error("This source if not compatible with GitHub Adapter");
    if (source.url !== "https://github.com/")
        throw new Error("This source doesn't allow custom url, please set it properly.");

    const gitHubApi = repoGitHubEndpointMaker();
    const result = await gitHubApi.search.repo.searchByName(queryString);

    if (!result) return [];

    return result?.items.map(gitHubSoftwareToExternalOption({ source }));
};
