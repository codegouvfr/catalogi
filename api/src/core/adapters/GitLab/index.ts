// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { checkHttpConnection, joinSourceUrl } from "../checkHttpConnection";
import { getGitLabSoftwareExternalData } from "./getExternalData";
import { getGitLabSoftwareForm } from "./getSoftwareFormData";
import { getGitLabSoftwareOptions } from "./getSoftwareOptions";

export const gitLabSourceGateway: GitLabGateway = {
    sourceType: "GitLab",
    // Public projects answer anonymously; a rejected token answers 401.
    checkConnection: ({ source, signal }) =>
        checkHttpConnection({
            url: joinSourceUrl(source.url, "/api/v4/projects?per_page=1&simple=true"),
            headers: source.configuration?.auth ? { "PRIVATE-TOKEN": source.configuration.auth } : {},
            isCredentialVerified: true,
            signal
        }),
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
