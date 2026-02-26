// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { PrimarySourceGateway } from "../../ports/SourceGateway";
import { getZenodoExternalData } from "./getZenodoExternalData";
import { getZenodoSoftwareFormData } from "./getZenodoSoftwareForm";
import { getZenodoSoftwareOptions } from "./getZenodoSoftwareOptions";

export const zenodoSourceGateway: PrimarySourceGateway = {
    sourceType: "Zenodo",
    sourceProfile: "Primary",
    softwareExternal: { getById: getZenodoExternalData },
    softwareOptions: { getById: getZenodoSoftwareOptions },
    softwareForm: { getById: getZenodoSoftwareFormData }
};
