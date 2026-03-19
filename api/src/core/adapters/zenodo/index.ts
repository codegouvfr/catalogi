// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { getZenodoExternalData } from "./getZenodoExternalData";
import { getZenodoSoftwareFormData } from "./getZenodoSoftwareForm";
import { getZenodoSoftwareOptions } from "./getZenodoSoftwareOptions";

export type ZenodoGateway = SourceGateway & {
    softwareExtra: NonNullable<SourceGateway["softwareExtra"]>;
    software: NonNullable<SourceGateway["software"]>;
};

export const zenodoSourceGateway: ZenodoGateway = {
    sourceType: "Zenodo",
    software: {
        getSoftwareForm: getZenodoSoftwareFormData,
        getSoftwareOptions: getZenodoSoftwareOptions
    },
    softwareExtra: {
        getSoftwareExternal: getZenodoExternalData
    }
};
