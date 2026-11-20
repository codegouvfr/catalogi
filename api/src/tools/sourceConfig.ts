// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceConfig } from "../core/adapters/dbApi/kysely/kysely.database";
import { Source } from "../lib/ApiTypes";
import { projectVersion } from "./projectVersion";

export const USER_ARGENT = `Catalogi/${projectVersion} (+https://github.com/codegouvfr/catalogi;`;

export const convertSourceConfigToRequestInit = (sourceConfig: SourceConfig | undefined): RequestInit => {
    if (!sourceConfig) return {};
    const headers: HeadersInit = {};

    if (sourceConfig.auth) {
        headers.Authorization = `Bearer ${sourceConfig.auth}`;
    }

    if (sourceConfig.agent) {
        headers["User-Agent"] = sourceConfig.agent["User-Agent"];
        if (sourceConfig.agent.from) headers.from = sourceConfig.agent.from;
    } else {
        headers["User-Agent"] = USER_ARGENT;
    }

    return {
        headers,
        ...(sourceConfig.queryTimeout ? { signal: AbortSignal.timeout(sourceConfig.queryTimeout) } : {})
    };
};

export const convertSourceConfigToBaseRequestOptions = (source: Source) => {
    return {
        host: source.url,
        ...(source.configuration?.auth ? { token: source.configuration.auth } : {}),
        ...(source.configuration?.queryTimeout ? { queryTimeout: source.configuration?.queryTimeout } : {})
    } as const;
};
