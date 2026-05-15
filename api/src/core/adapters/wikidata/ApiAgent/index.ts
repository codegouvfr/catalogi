// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes <contact-logiciels-catalogue-esr@groupes.renater.fr>
// SPDX-License-Identifier: MIT

import { convertSourceConfigToRequestInit } from "../../../../tools/sourceConfig";
import { Source } from "../../../usecases/readWriteSillData";
import { fetchEntity } from "./entity";
import { getOrganisationFromApi } from "./getOrganisation";
import { getLicenses } from "./getLicenses";

export const makeWikidataAPIAgent = (source?: Source) => {
    const requestInit = source?.configuration ? convertSourceConfigToRequestInit(source.configuration) : {};

    const wikidataRequestInit = {
        ...requestInit,
        headers: {
            ...(requestInit?.headers ?? {}),
            "Accept": "application/json"
        }
    };

    return {
        fetchEntity: (entityId: string) =>
            fetchEntity({
                wikidataId: entityId,
                requestInit: wikidataRequestInit,
                rateLimitRetryDuration: source?.configuration?.rateLimitRetryDuration
            }),
        getLicenses: (wikidataIds: string[]) => getLicenses({ wikidataIds, requestInit: wikidataRequestInit }),
        getOrganization: (entityId: string) =>
            getOrganisationFromApi({
                entityId,
                requestInit: wikidataRequestInit,
                rateLimitRetryDuration: source?.configuration?.rateLimitRetryDuration
            })
    };
};
