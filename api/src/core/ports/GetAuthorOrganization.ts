// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SchemaOrganization } from "../adapters/dbApi/kysely/kysely.database";

export type GetAuthorOrganization = (organizationId: string) => Promise<SchemaOrganization | undefined>;
