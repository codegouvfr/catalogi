// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ExternalDataOriginKind } from "../adapters/dbApi/kysely/kysely.database";
import { GetAuthorOrganization } from "./GetAuthorOrganization";
import { GetSoftwareExternal } from "./GetSoftwareExternal";
import { GetSoftwareExternalDataOptions } from "./GetSoftwareExternalDataOptions";
import { GetSoftwareFormData } from "./GetSoftwareFormData";

export type Feature = "software" | "softwareExtra";
export type Features = Feature[];

export type SoftwareLink = { externalId: string; softwareId: number; softwareName?: string };

export type SearchOrganizationCriteria = {
    name?: string;
    identifer?: {
        base: string;
        value: string;
    };
};

export interface SourceGateway {
    sourceType: ExternalDataOriginKind;
    software?: {
        getSoftwareOptions: GetSoftwareExternalDataOptions;
        getSoftwareForm: GetSoftwareFormData;
    };
    softwareExtra?: {
        getSoftwareExternal: GetSoftwareExternal;
        getDiscoverSoftwareLinks?: () => Promise<SoftwareLink[]>;
    };
    organization?: {
        getOrganization: GetAuthorOrganization;
        searchOrganization?: (search: SearchOrganizationCriteria) => Promise<string[] | undefined>;
    };
}
