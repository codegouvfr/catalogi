// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { BaseRequestOptionsWithAccessToken, BaseRequestOptionsWithoutToken } from "@gitbeaker/requester-utils";
import { SourceConfig } from "../core/adapters/dbApi/kysely/kysely.database";
import { Source } from "../lib/ApiTypes";

export const convertSourceConfigToRequestInit = (sourceConfig: SourceConfig | undefined): RequestInit => {
    if (!sourceConfig) return {};
    return {
        ...(sourceConfig.auth ? { headers: { Authorization: `Bearer ${sourceConfig.auth}` } } : {}),
        ...(sourceConfig.queryTimeout ? { signal: AbortSignal.timeout(sourceConfig.queryTimeout) } : {})
    };
};

export const convertSourceConfigToBaseRequestOptions = (
    source: Source
): BaseRequestOptionsWithAccessToken<false> | BaseRequestOptionsWithoutToken<false> => {
    return {
        host: source.url,
        ...(source.configuration?.auth ? { token: source.configuration.auth } : {}),
        ...(source.configuration?.queryTimeout ? { queryTimeout: source.configuration?.queryTimeout } : {})
    };
};
