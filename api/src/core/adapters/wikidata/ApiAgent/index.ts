// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { convertSourceConfigToRequestInit } from "../../../../tools/sourceConfig";
import { Source } from "../../../usecases/readWriteSillData";
import { fetchEntity } from "./entity";
import { getLicenses } from "./getLicenses";

export const makeWikidataAPIAgent = (source: Source) => {
    const requestInit = convertSourceConfigToRequestInit(source.configuration);
    return {
        fetchEntity: (entityId: string) => fetchEntity({ wikidataId: entityId, requestInit }),
        getLicenses: (wikidataIds: string[]) => getLicenses({ wikidataIds, requestInit })
    };
};
