// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { Source } from "../../usecases/readWriteSillData";
import { getOrganisationFromRNSRApi } from "./API/get";

export type RNSRSourceGateway = SourceGateway & {
    organization: NonNullable<SourceGateway["organization"]>;
};

export const rnsrSourceGateway: RNSRSourceGateway = {
    sourceType: "RNSR",
    organization: {
        getOrganization: (params: { organizationId: string; source?: Source }) => {
            const org = getOrganisationFromRNSRApi({ rnsrId: params.organizationId });
            return org;
        }
    }
};
