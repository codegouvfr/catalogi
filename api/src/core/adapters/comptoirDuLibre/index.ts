// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { getCDLSoftwareOptions } from "./getCDLSoftwareOptions";
import { getCDLSoftwareExternalData } from "./getCDLExternalData";
import { getCDLFormData } from "./getCDLFormData";
import { PrimarySourceGateway } from "../../ports/SourceGateway";
import { comptoirDuLibreApi } from "../comptoirDuLibreApi";

export const comptoirDuLibreSourceGateway: PrimarySourceGateway = {
    sourceType: "ComptoirDuLibre",
    sourceProfile: "Primary",
    softwareExternalData: {
        getById: getCDLSoftwareExternalData
    },
    softwareOptions: {
        getById: getCDLSoftwareOptions
    },
    softwareForm: {
        getById: getCDLFormData
    },
    discoverSoftwareLinks: async () => {
        const cdlData = await comptoirDuLibreApi.getComptoirDuLibre();
        return cdlData.softwares
            .filter(software => !Array.isArray(software.external_resources.sill))
            .map(software => {
                const sill = software.external_resources.sill as { id: number };
                return {
                    externalId: software.id.toString(),
                    softwareId: sill.id,
                    softwareName: software.name
                };
            });
    }
};
