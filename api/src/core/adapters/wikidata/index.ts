// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { PrimarySourceGateway } from "../../ports/SourceGateway";
import { getWikidataForm } from "./getSoftwareForm";
import { getWikidataSoftware } from "./getWikidataSoftware";
import { getWikidataSoftwareOptions } from "./getWikidataSoftwareOptions";
import { toCanonicalSoftwareExternalGetter } from "../../types/softwareExternalMappers";

const getWikidataSoftwareExternal = toCanonicalSoftwareExternalGetter(getWikidataSoftware);

export const wikidataSourceGateway: PrimarySourceGateway = {
    sourceType: "wikidata",
    sourceProfile: "Primary",
    softwareExternal: {
        getById: getWikidataSoftwareExternal
    },
    softwareExternalData: {
        getById: getWikidataSoftware
    },
    softwareOptions: {
        getById: getWikidataSoftwareOptions
    },
    softwareForm: {
        getById: getWikidataForm
    }
};
