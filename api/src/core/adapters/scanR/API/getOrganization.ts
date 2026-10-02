// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ScanrSearchResponse, AgretatedScanROrganization } from "./scanRType";

const ROR_TIMEOUT_RESET = 1000;

export const fetchOrganizationById = async (params: {
    organizationId: string;
    requestInit?: RequestInit;
    rateLimitRetryDuration?: number;
}): Promise<AgretatedScanROrganization | undefined> => {
    const { organizationId, requestInit = {}, rateLimitRetryDuration = ROR_TIMEOUT_RESET } = params;
    const url = `https://cluster-production.elasticsearch.dataesr.ovh/scanr-organizations/_search?q=externalIds.id.keyword:${organizationId}`;

    try {
        const response = await fetch(url, requestInit);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (response.status === 429) {
            await new Promise(resolve => setTimeout(resolve, rateLimitRetryDuration));
            return fetchOrganizationById(params);
        }

        const data: ScanrSearchResponse | undefined = await response.json();
        if (data) {
            if (data.hits.total.value === 0) return undefined;
            if (data.hits.total.value === 1) return data.hits.hits[0]._source;
            else {
                const active = data.hits.hits.filter(hit => {
                    return hit._source.status === "active";
                });
                if (active.length !== 1) console.error("Range Error : More than one result");
                return active[0]._source;
            }
        }
        return undefined;
    } catch (error) {
        console.error(`Erreur lors de la récupération de l'organisation ROR (${organizationId}):`, error);
        return undefined;
    }
};
