// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { getCDLSoftwareOptions } from "./getCDLSoftwareOptions";
import { getCDLSoftwareExternalData } from "./getCDLExternalData";
import { getCDLFormData } from "./getCDLFormData";
import { SourceGateway } from "../../ports/SourceGateway";
import { comptoirDuLibreApi } from "../comptoirDuLibreApi";

export type CDLGateway = SourceGateway & {
    softwareExtra: NonNullable<SourceGateway["softwareExtra"]>;
    software: NonNullable<SourceGateway["software"]>;
};

export const comptoirDuLibreSourceGateway: CDLGateway = {
    sourceType: "ComptoirDuLibre",
    software: {
        getSoftwareForm: getCDLFormData,
        getSoftwareOptions: getCDLSoftwareOptions
    },
    softwareExtra: {
        getSoftwareExternal: getCDLSoftwareExternalData,
        getDiscoverSoftwareLinks: async () => {
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
    }
};
