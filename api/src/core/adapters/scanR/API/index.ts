// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Source } from "../../../usecases/readWriteSillData";
import { fetchOrganizationById } from "./getOrganization";
import { AgretatedScanROrganization } from "./scanRType";

export type ScanRSource = {
    organizations: {
        search: (organizationId: string) => Promise<AgretatedScanROrganization | undefined>;
    };
};

const buildLogginEncoddedString = (username: string, password: string): { Authorization: string } => {
    const phrase = `${username}:${password}`;
    const encoded = btoa(phrase);
    return { "Authorization": `Basic ${encoded}` };
};

export const makeScanRApi = (source?: Source): ScanRSource => {
    const headers = {
        Accept: "application/json",
        ...(source?.configuration?.username && source?.configuration?.password
            ? buildLogginEncoddedString(source.configuration.username, source.configuration.password)
            : {})
    };

    return {
        organizations: {
            search: (organizationId: string) =>
                fetchOrganizationById({
                    organizationId,
                    requestInit: { headers },
                    rateLimitRetryDuration: source?.configuration?.rateLimitRetryDuration
                })
        }
    };
};
