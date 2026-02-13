// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SecondarySourceGateway } from "../../ports/SourceGateway";
import { getCNLLSoftwareExternalData } from "./getExternalData";
import { getCnllPrestatairesSill } from "../getCnllPrestatairesSill";
import { toCanonicalSoftwareExternalGetter } from "../../types/softwareExternalMappers";

const getCNLLSoftwareExternal = toCanonicalSoftwareExternalGetter(getCNLLSoftwareExternalData);

export const cnllSourceGateway: SecondarySourceGateway = {
    sourceType: "ComptoirDuLibre",
    sourceProfile: "Secondary",
    softwareExternal: {
        getById: getCNLLSoftwareExternal
    },
    softwareExternalData: {
        getById: getCNLLSoftwareExternalData
    },
    discoverSoftwareLinks: async () => {
        const cnllProviders = await getCnllPrestatairesSill();
        return cnllProviders.map(provider => ({
            externalId: provider.sill_id.toString(),
            softwareId: provider.sill_id,
            softwareName: provider.nom
        }));
    }
};
