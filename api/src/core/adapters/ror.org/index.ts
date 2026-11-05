// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { checkHttpConnection } from "../checkHttpConnection";
import { Source } from "../../usecases/readWriteSillData";
import { makeRorOrgApi } from "./API";

export type RORSourceGateway = SourceGateway & {
    organization: NonNullable<SourceGateway["organization"]>;
};

export const rorSourceGateway: RORSourceGateway = {
    sourceType: "ROR",
    checkConnection: ({ source, signal }) =>
        checkHttpConnection({
            url: "https://api.ror.org/v2/organizations?page=1",
            headers: {
                Accept: "application/json",
                ...(source.configuration?.auth ? { "Client-Id": source.configuration.auth } : {})
            },
            signal
        }),
    organization: {
        getOrganization: (params: { organizationId: string; source?: Source }) => {
            const rorApiAgent = makeRorOrgApi(params.source);
            return rorApiAgent.organization.get(params.organizationId);
        }
    }
};
