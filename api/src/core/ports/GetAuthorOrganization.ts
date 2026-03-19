// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SchemaOrganization } from "../adapters/dbApi/kysely/kysely.database";
import { Source } from "../usecases/readWriteSillData";

export type GetAuthorOrganization = (params: {
    organizationId: string;
    source: Source;
}) => Promise<SchemaOrganization | undefined>;
