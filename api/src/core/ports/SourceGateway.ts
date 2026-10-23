// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ExternalDataOriginKind } from "../adapters/dbApi/kysely/kysely.database";
import { GetOrganization } from "./GetOrganization";
import { GetSoftwareExternal } from "./GetSoftwareExternal";
import { GetSoftwareExternalDataOptions } from "./GetSoftwareExternalDataOptions";
import { GetSoftwareFormData } from "./GetSoftwareFormData";
import { SearchOrganization } from "./SearchOrganization";
import type { Source } from "../usecases/readWriteSillData";

export type Feature = "software" | "softwareExtra";
export type Features = Feature[];

export type SoftwareLink = { externalId: string; softwareId: number; softwareName?: string };

export type RepositoryMatch = {
    externalId: string;
    name: string | undefined;
    // Page of the entry on the source, to let the user check the match.
    url: string;
};

// `repoUrls` holds the spellings of a single repository url (trailing slash, `.git`...).
export type FindSoftwareByRepositoryUrl = (params: {
    repoUrls: string[];
    source: Source;
    signal: AbortSignal;
}) => Promise<RepositoryMatch | undefined>;

export interface SourceGateway {
    sourceType: ExternalDataOriginKind;
    software?: {
        getSoftwareOptions: GetSoftwareExternalDataOptions;
        getSoftwareForm: GetSoftwareFormData;
    };
    softwareExtra?: {
        getSoftwareExternal: GetSoftwareExternal;
        getDiscoverSoftwareLinks?: () => Promise<SoftwareLink[]>;
        findByRepositoryUrl?: FindSoftwareByRepositoryUrl;
    };
    organization?: {
        getOrganization: GetOrganization;
        searchOrganization?: SearchOrganization;
    };
}
