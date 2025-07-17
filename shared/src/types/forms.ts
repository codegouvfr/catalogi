// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { SoftwareType } from "./domain";

export type SoftwareFormData = {
    softwareName: string;
    softwareDescription: string;
    softwareType: SoftwareType;
    externalIdForSource: string | undefined;
    sourceSlug: string;
    comptoirDuLibreId: number | undefined;
    softwareLicense: string;
    softwareMinimalVersion: string | undefined;
    similarSoftwareExternalDataIds: string[];
    softwareLogoUrl: string | undefined;
    softwareKeywords: string[];

    isPresentInSupportContract: boolean;
    isFromFrenchPublicService: boolean;
    doRespectRgaa: boolean | null;
};

export type InstanceFormData = {
    mainSoftwareSillId: number;
    organization: string;
    targetAudience: string;
    instanceUrl: string | undefined;
    isPublic: boolean;
};