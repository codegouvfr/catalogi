// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { GetAuthorOrganization } from "../../ports/GetAuthorOrganization";
import { OtherSource } from "../../ports/SourceGateway";
import { fetchRorOrganizationById } from "./API/getOrganization";

type RorSource = OtherSource & {
    organization: {
        get: GetAuthorOrganization;
    };
};

export const rorOrgApi: RorSource = {
    organization: {
        get: fetchRorOrganizationById
    }
};
