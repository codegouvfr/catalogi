// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { FindSoftwareByRepositoryUrl } from "../../ports/SourceGateway";
import { comptoirDuLibreApi } from "../comptoirDuLibreApi";
import { normalizeRepoUrl } from "../resolveRepository";

const toComparable = (url: string) => normalizeRepoUrl(url)?.toLowerCase();

// The export is memoized: only the first lookup pays for the download.
export const findCDLByRepositoryUrl: FindSoftwareByRepositoryUrl = async ({ repoUrls }) => {
    const wanted = new Set(repoUrls.map(toComparable));
    wanted.delete(undefined);

    const { softwares } = await comptoirDuLibreApi.getComptoirDuLibre();
    const matches = softwares.filter(software => {
        const repository = software.external_resources.repository;
        return repository !== null && wanted.has(toComparable(repository));
    });

    if (matches.length !== 1) return undefined;

    return {
        externalId: matches[0].id.toString(),
        name: matches[0].name,
        url: `https://comptoir-du-libre.org/fr/softwares/${matches[0].id}`
    };
};
