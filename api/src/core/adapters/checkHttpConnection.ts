// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { SourceConnectionCheck } from "../ports/SourceGateway";
import type { Source } from "../usecases/readWriteSillData";

export const userAgentHeaders = { "User-Agent": "catalogi-sill (https://code.gouv.fr/sill)" };

export const bearerAuthHeaders = (source: Source): Record<string, string> =>
    source.configuration?.auth ? { Authorization: `Bearer ${source.configuration.auth}` } : {};

export const checkHttpConnection = async (params: {
    url: string;
    method?: "GET" | "HEAD";
    headers?: Record<string, string>;
    signal: AbortSignal;
}): Promise<SourceConnectionCheck> => {
    const { url, method = "GET", headers = {}, signal } = params;

    try {
        const response = await fetch(url, { method, headers, signal });
        await response.body?.cancel();
        return response.ok ? { status: "ok" } : { status: "httpError", httpStatus: response.status };
    } catch {
        return { status: "unreachable" };
    }
};

// Source urls are stored with or without a trailing slash.
export const joinSourceUrl = (sourceUrl: string, path: string) => `${sourceUrl.replace(/\/+$/, "")}${path}`;
