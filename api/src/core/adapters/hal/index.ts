// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { getHalSoftwareOptions } from "./getHalSoftwareOptions";
import { getHalSoftwareExternalData } from "./getHalSoftwareExternalData";
import { getHalSoftwareForm } from "./getSoftwareForm";
import { PrimarySourceGateway } from "../../ports/SourceGateway";
import { toCanonicalSoftwareExternalGetter } from "../../types/softwareExternalMappers";

const getHalSoftwareExternal = toCanonicalSoftwareExternalGetter(getHalSoftwareExternalData);

export const halSourceGateway: PrimarySourceGateway = {
    sourceType: "HAL",
    sourceProfile: "Primary",
    softwareExternal: {
        getById: getHalSoftwareExternal
    },
    softwareExternalData: {
        getById: getHalSoftwareExternalData
    },
    softwareOptions: {
        getById: getHalSoftwareOptions
    },
    softwareForm: {
        getById: getHalSoftwareForm
    }
};
