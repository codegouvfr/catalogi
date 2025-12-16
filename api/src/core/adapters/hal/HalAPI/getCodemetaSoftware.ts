// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { HAL } from "./types/HAL";

export async function fetchCodeMetaSoftwareByURL(url: string): Promise<HAL.SoftwareApplication | undefined> {
    const res = await fetch(`${url}/codemeta`, {
        signal: AbortSignal.timeout(10000)
    }).catch(err => {
        console.error(url, err);
    });

    if (res === undefined) {
        throw new HAL.API.FetchError(undefined);
    }

    if (res.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return fetchCodeMetaSoftwareByURL(url);
    }

    if (res.status === 404 || res.status >= 500) {
        throw new HAL.API.FetchError(res.status);
    }

    const json = await res.json();

    return json;
}
