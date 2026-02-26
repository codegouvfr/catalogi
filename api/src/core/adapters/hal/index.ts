// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { getHalSoftwareOptions } from "./getHalSoftwareOptions";
import { getHalSoftwareExternal } from "./getHalSoftwareExternalData";
import { getHalSoftwareForm } from "./getSoftwareForm";
import { PrimarySourceGateway } from "../../ports/SourceGateway";

export const halSourceGateway: PrimarySourceGateway = {
    sourceType: "HAL",
    sourceProfile: "Primary",
    softwareExternal: { getById: getHalSoftwareExternal },
    softwareOptions: { getById: getHalSoftwareOptions },
    softwareForm: { getById: getHalSoftwareForm }
};
