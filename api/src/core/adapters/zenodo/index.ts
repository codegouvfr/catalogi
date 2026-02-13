// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { PrimarySourceGateway } from "../../ports/SourceGateway";
import { getZenodoExternalData } from "./getZenodoExternalData";
import { getZenodoSoftwareFormData } from "./getZenodoSoftwareForm";
import { getZenodoSoftwareOptions } from "./getZenodoSoftwareOptions";
import { toCanonicalSoftwareExternalGetter } from "../../types/softwareExternalMappers";

const getZenodoSoftwareExternal = toCanonicalSoftwareExternalGetter(getZenodoExternalData);

export const zenodoSourceGateway: PrimarySourceGateway = {
    sourceType: "Zenodo",
    sourceProfile: "Primary",
    softwareExternal: {
        getById: getZenodoSoftwareExternal
    },
    softwareExternalData: {
        getById: getZenodoExternalData
    },
    softwareOptions: {
        getById: getZenodoSoftwareOptions
    },
    softwareForm: {
        getById: getZenodoSoftwareFormData
    }
};
