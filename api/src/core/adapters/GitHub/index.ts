// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { PrimarySourceGateway } from "../../ports/SourceGateway";
import { getGitHubSoftwareExternalData } from "./getExternalData";
import { getGitHubSoftwareFOrm } from "./getSofrwareFormData";
import { getGitHubSoftwareOptions } from "./getSoftwareOptions";
import { toCanonicalSoftwareExternalGetter } from "../../types/softwareExternalMappers";

const getGitHubSoftwareExternal = toCanonicalSoftwareExternalGetter(getGitHubSoftwareExternalData);

export const gitHubSourceGateway: PrimarySourceGateway = {
    sourceType: "GitHub",
    sourceProfile: "Primary",
    softwareExternal: {
        getById: getGitHubSoftwareExternal
    },
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
