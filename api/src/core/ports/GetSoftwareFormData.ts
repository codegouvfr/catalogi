// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { SoftwareFormData } from "shared";

export type GetSoftwareFormData = (externalId: string) => Promise<SoftwareFormData | undefined>;
