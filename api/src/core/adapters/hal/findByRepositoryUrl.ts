// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { FindSoftwareByRepositoryUrl } from "../../ports/SourceGateway";
import { convertSourceConfigToRequestInit } from "../../../tools/sourceConfig";

type SearchResponse = {
    response?: { docs?: { docid: string; title_s?: string[]; uri_s: string }[] };
};

export const findHalByRepositoryUrl: FindSoftwareByRepositoryUrl = async ({ repoUrls, source, signal }) => {
    const searchParams = new URLSearchParams({
        q: `softCodeRepository_s:(${repoUrls.map(url => `"${url.replaceAll('"', "")}"`).join(" OR ")})`,
        fq: "docType_s:SOFTWARE",
        fl: "docid,title_s,uri_s",
        rows: "2",
        wt: "json"
    });

    const response = await fetch(`https://api.archives-ouvertes.fr/search/?${searchParams}`, {
        ...convertSourceConfigToRequestInit(source.configuration),
        signal
    });
    if (!response.ok) throw new Error(`HAL search failed with status ${response.status}`);

    const docs = ((await response.json()) as SearchResponse).response?.docs ?? [];

    // Several deposits of the same repository cannot be told apart here.
    if (docs.length !== 1) return undefined;

    return { externalId: docs[0].docid.toString(), name: docs[0].title_s?.[0], url: docs[0].uri_s };
};
