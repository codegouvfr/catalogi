// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { getHalSoftwareOptions } from "./getHalSoftwareOptions";
import { getHalSoftwareExternal } from "./getHalSoftwareExternalData";
import { getHalSoftwareForm } from "./getSoftwareForm";
import { SourceGateway } from "../../ports/SourceGateway";

export type HALGateway = SourceGateway & {
    softwareExtra: NonNullable<SourceGateway["softwareExtra"]>;
    software: NonNullable<SourceGateway["software"]>;
};

export const halSourceGateway: HALGateway = {
    sourceType: "HAL",
    software: {
        getSoftwareForm: getHalSoftwareForm,
        getSoftwareOptions: getHalSoftwareOptions
    },
    softwareExtra: {
        getSoftwareExternal: getHalSoftwareExternal
    }
};
