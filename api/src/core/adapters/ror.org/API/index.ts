// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Source } from "../../../usecases/readWriteSillData";
import { SchemaOrganization } from "../../dbApi/kysely/kysely.database";
import { fetchRorOrganizationById } from "./getOrganization";

export type RorSource = {
    organization: {
        get: (rorId: string) => Promise<SchemaOrganization | undefined>;
    };
};

export const makeRorOrgApi = (source?: Source): RorSource => {
    const headers = {
        Accept: "application/json",
        ...(source?.configuration?.auth ? { "Client-Id": source.configuration.auth } : {})
    };

    return {
        organization: {
            get: (rorId: string) =>
                fetchRorOrganizationById({
                    rorId,
                    ...{ headers },
                    rateLimitRetryDuration: source?.configuration?.rateLimitRetryDuration
                })
        }
    };
};
