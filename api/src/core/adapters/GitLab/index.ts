// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { PrimarySourceGateway } from "../../ports/SourceGateway";
import { getGitLabSoftwareExternalData } from "./getExternalData";
import { getGitLabSoftwareForm } from "./getSoftwareFormData";
import { getGitLabSoftwareOptions } from "./getSoftwareOptions";

export const gitLabSourceGateway: PrimarySourceGateway = {
    sourceType: "GitHub",
    sourceProfile: "Primary",
    softwareExternalData: {
        getById: getGitLabSoftwareExternalData
    },
    softwareOptions: {
        getById: getGitLabSoftwareOptions
    },
    softwareForm: {
        getById: getGitLabSoftwareForm
    }
};
