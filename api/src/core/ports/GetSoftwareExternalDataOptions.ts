// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Source } from "shared";
import type { Language } from "./GetSoftwareExternalData";

export type SoftwareExternalDataOption = {
    externalId: string;
    label: string;
    description: string;
    isLibreSoftware: boolean;
    sourceSlug: string;
};

export type GetSoftwareExternalDataOptions = (params: {
    queryString: string;
    language: Language;
    source: Source;
}) => Promise<SoftwareExternalDataOption[]>;
