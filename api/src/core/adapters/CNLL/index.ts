// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { getCNLLSoftwareExternalData } from "./getExternalData";
import { getCnllPrestatairesSill } from "../getCnllPrestatairesSill";

export type CNLLGateway = SourceGateway & {
    softwareExtra: NonNullable<SourceGateway["softwareExtra"]>;
};

export const cnllSourceGateway: CNLLGateway = {
    sourceType: "CNLL",
    softwareExtra: {
        getSoftwareExternal: getCNLLSoftwareExternalData,
        getDiscoverSoftwareLinks: async () => {
            const cnllProviders = await getCnllPrestatairesSill();
            return cnllProviders.map(provider => ({
                externalId: provider.sill_id.toString(),
                softwareId: provider.sill_id,
                softwareName: provider.nom
            }));
        }
    }
};
