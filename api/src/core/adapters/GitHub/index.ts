// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { getGitHubSoftwareExternalData } from "./getExternalData";
import { getGitHubSoftwareFOrm } from "./getSofrwareFormData";
import { getGitHubSoftwareOptions } from "./getSoftwareOptions";

export type GitHubGateway = SourceGateway & {
    softwareExtra: NonNullable<SourceGateway["softwareExtra"]>;
    software: NonNullable<SourceGateway["software"]>;
};

export const gitHubSourceGateway: GitHubGateway = {
    sourceType: "GitHub",
    software: {
        getSoftwareForm: getGitHubSoftwareFOrm,
        getSoftwareOptions: getGitHubSoftwareOptions
    },
    softwareExtra: {
        getSoftwareExternal: getGitHubSoftwareExternalData
    }
};
