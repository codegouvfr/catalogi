// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Gitlab, ProjectSchema } from "@gitbeaker/rest";
import type {
    GetSoftwareExternalDataOptions,
    SoftwareExternalDataOption
} from "../../ports/GetSoftwareExternalDataOptions";
import { Source } from "../../usecases/readWriteSillData";

const gitLabSoftwareToExternalOption =
    ({ source }: { source: Source }) =>
    (gitLabItem: ProjectSchema): SoftwareExternalDataOption => {
        return {
            externalId: gitLabItem.id.toString(),
            label: gitLabItem.name,
            description: gitLabItem.description,
            isLibreSoftware: false,
            sourceSlug: source.slug
        };
    };

export const getGitLabSoftwareOptions: GetSoftwareExternalDataOptions = async ({ queryString, language, source }) => {
    if (source.kind !== "GitLab") throw new Error("This source if not compatible with GitLab Adapter");

    console.info(`GitLab doesn't support multi languages, ${language} not used`);

    const api = new Gitlab({
        host: source.url
    });

    const result = await api.Projects.all({ search: queryString });

    if (!result) return [];

    return result.map(gitLabSoftwareToExternalOption({ source }));
};
