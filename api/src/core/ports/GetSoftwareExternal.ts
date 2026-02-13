// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Source } from "../usecases/readWriteSillData";
import type { SoftwareExternal } from "../types/SoftwareTypes";

type ExternalId = string;

export type GetSoftwareExternal = {
    (params: { externalId: ExternalId; source: Source }): Promise<SoftwareExternal | undefined>;
    clear: (externalId: ExternalId) => void;
};
