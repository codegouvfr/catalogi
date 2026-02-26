// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import memoize from "memoizee";
import { Gitlab } from "@gitbeaker/rest";

import { GetSoftwareFormData } from "../../ports/GetSoftwareFormData";
import { SoftwareFormData, Source } from "../../usecases/readWriteSillData";
import { resolveOsAndPlatforms } from "../../utils";
import { resolveExternalReferenceToProject } from "./api/utils";

export const getGitLabSoftwareForm: GetSoftwareFormData = memoize(
    async ({ externalId, source }: { externalId: string; source: Source }): Promise<SoftwareFormData | undefined> => {
        if (source.kind !== "GitLab") throw new Error("This source if not compatible with GitLab Adapter");

        const api = new Gitlab({
            host: source.url
        });

        const project = await resolveExternalReferenceToProject({ externalId, gitLabApi: api });
        if (!project) return;

        const formData: SoftwareFormData = {
            name: project.name,
            description: project?.description,
            ...resolveOsAndPlatforms(project.topics ?? []), // Someting else to rely on ?
            externalIdForSource: project.web_url,
            sourceSlug: source.slug,
            license: project.license.name ?? "undefined",
            similarSoftwareExternalDataItems: [],
            image: project.avatar_url ?? undefined,
            keywords: project.topics || [],
            customAttributes: undefined
        };

        return formData;
    }
);
