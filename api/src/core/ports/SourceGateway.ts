// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ExternalDataOriginKind } from "../adapters/dbApi/kysely/kysely.database";
import { GetSoftwareExternal } from "./GetSoftwareExternal";
import { GetSoftwareExternalDataOptions } from "./GetSoftwareExternalDataOptions";
import { GetSoftwareFormData } from "./GetSoftwareFormData";

export type SoftwareLink = { externalId: string; softwareId: number; softwareName?: string };

export type BaseSourceGateway = {
    sourceProfile: "Primary" | "Secondary";
    sourceType: ExternalDataOriginKind;
    softwareExternal: { getById: GetSoftwareExternal };
    discoverSoftwareLinks?: () => Promise<SoftwareLink[]>;
};

export type PrimarySourceGateway = BaseSourceGateway & {
    sourceProfile: "Primary";
    softwareOptions: { getById: GetSoftwareExternalDataOptions };
    softwareForm: { getById: GetSoftwareFormData };
};

export type SecondarySourceGateway = BaseSourceGateway & {
    sourceProfile: "Secondary";
};
