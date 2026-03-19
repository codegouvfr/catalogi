// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ExternalDataOriginKind } from "../adapters/dbApi/kysely/kysely.database";
import { GetSoftwareExternal } from "./GetSoftwareExternal";
import { GetSoftwareExternalDataOptions } from "./GetSoftwareExternalDataOptions";
import { GetSoftwareFormData } from "./GetSoftwareFormData";

export type Feature = "software" | "softwareExtra";
export type Features = Feature[];

export type SoftwareLink = { externalId: string; softwareId: number; softwareName?: string };

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
}
