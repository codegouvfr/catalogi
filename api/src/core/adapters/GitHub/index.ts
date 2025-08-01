// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { PrimarySourceGateway } from "../../ports/SourceGateway";
import { getGitHubSoftwareExternalData } from "./getExternalData";
import { getGitHubSoftwareFOrm } from "./getSofrwareFormData";
import { getGitHubSoftwareOptions } from "./getSoftwareOptions";

export const gitHubSourceGateway: PrimarySourceGateway = {
    sourceType: "GitHub",
    sourceProfile: "Primary",
    softwareExternalData: {
        getById: getGitHubSoftwareExternalData
    },
    softwareOptions: {
        getById: getGitHubSoftwareOptions
    },
    softwareForm: {
        getById: getGitHubSoftwareFOrm
    }
};
