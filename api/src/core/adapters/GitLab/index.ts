// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { getGitLabSoftwareExternalData } from "./getExternalData";
import { getGitLabSoftwareForm } from "./getSoftwareFormData";
import { getGitLabSoftwareOptions } from "./getSoftwareOptions";

export const gitLabSourceGateway: GitLabGateway = {
    sourceType: "GitLab",
    software: {
        getSoftwareForm: getGitLabSoftwareForm,
        getSoftwareOptions: getGitLabSoftwareOptions
    },
    softwareExtra: {
        getSoftwareExternal: getGitLabSoftwareExternalData
    }
};

export type GitLabGateway = SourceGateway & {
    softwareExtra: NonNullable<SourceGateway["softwareExtra"]>;
    software: NonNullable<SourceGateway["software"]>;
};
