// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SourceGateway } from "../../ports/SourceGateway";
import { getWikidataForm } from "./getSoftwareForm";
import { getWikidataSoftware } from "./getWikidataSoftware";
import { getWikidataSoftwareOptions } from "./getWikidataSoftwareOptions";

export type WikidataGateway = SourceGateway & {
    softwareExtra: NonNullable<SourceGateway["softwareExtra"]>;
    software: NonNullable<SourceGateway["software"]>;
};

export const wikidataSourceGateway: WikidataGateway = {
    sourceType: "wikidata",
    software: {
        getSoftwareOptions: getWikidataSoftwareOptions,
        getSoftwareForm: getWikidataForm
    },
    softwareExtra: {
        getSoftwareExternal: getWikidataSoftware
    }
};
