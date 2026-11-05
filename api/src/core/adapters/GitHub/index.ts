// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { checkHttpConnection, userAgentHeaders } from "../checkHttpConnection";
import { getGitHubSoftwareExternalData } from "./getExternalData";
import { getGitHubSoftwareFOrm } from "./getSofrwareFormData";
import { getGitHubSoftwareOptions } from "./getSoftwareOptions";

export type GitHubGateway = SourceGateway & {
    softwareExtra: NonNullable<SourceGateway["softwareExtra"]>;
    software: NonNullable<SourceGateway["software"]>;
};

export const gitHubSourceGateway: GitHubGateway = {
    sourceType: "GitHub",
    // Not counted against the rate limit; answers 401 when the token is rejected.
    checkConnection: ({ source, signal }) =>
        checkHttpConnection({
            url: "https://api.github.com/rate_limit",
            headers: {
                ...userAgentHeaders,
                Accept: "application/vnd.github+json",
                ...(source.configuration?.auth ? { Authorization: `Bearer ${source.configuration.auth}` } : {})
            },
            signal
        }),
    software: {
        getSoftwareForm: getGitHubSoftwareFOrm,
        getSoftwareOptions: getGitHubSoftwareOptions
    },
    softwareExtra: {
        getSoftwareExternal: getGitHubSoftwareExternalData
    }
};
