// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

import { convertSourceConfigToRequestInit } from "../../../../tools/sourceConfig";
import { Source } from "../../../usecases/readWriteSillData";
import { fetchEntity, fetchEntityAliasesEn } from "./entity";
import { getOrganisationFromApi } from "./getOrganisation";
import { getLicenses } from "./getLicenses";

export const makeWikidataAPIAgent = (source: Source) => {
    const requestInit = source?.configuration ? convertSourceConfigToRequestInit(source.configuration) : {};

    return {
        fetchEntity: (entityId: string) =>
            fetchEntity({
                wikidataId: entityId,
                requestInit
            }),
        fetchEntityAliasesEn: (wikidataIds: string[]) => fetchEntityAliasesEn({ wikidataIds, requestInit }),
        getLicenses: (wikidataIds: string[]) => getLicenses({ wikidataIds, sourceUrl: source.url, requestInit }),
        getOrganization: (entityId: string) =>
            getOrganisationFromApi({
                entityId,
                requestInit,
                rateLimitRetryDuration: source?.configuration?.rateLimitRetryDuration
            })
    };
};
