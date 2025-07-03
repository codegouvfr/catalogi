// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SoftwareFormData } from "../usecases/readWriteSillData";

export type GetSoftwareFormData = (externalId: string) => Promise<SoftwareFormData | undefined>;
