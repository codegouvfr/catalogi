// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DbApiV2 } from "../ports/DbApiV2";
import type { AttributeDefinition } from "./readWriteSillData/attributeTypes";

type Dependencies = {
    dbApi: DbApiV2;
};

export const getAttributeDefinitions = async (deps: Dependencies): Promise<AttributeDefinition[]> => {
    return deps.dbApi.attributeDefinition.getAll();
};
