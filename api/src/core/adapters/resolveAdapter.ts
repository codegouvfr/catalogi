// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { PrimarySourceGateway, SecondarySourceGateway } from "../ports/SourceGateway";
import { DatabaseDataType } from "../ports/DbApiV2";
import { USER_INPUT_SOURCE_SLUG } from "./dbApi/kysely/kysely.database";
import { halSourceGateway } from "./hal";
import { wikidataSourceGateway } from "./wikidata";
import { comptoirDuLibreSourceGateway } from "./comptoirDuLibre";
import { zenodoSourceGateway } from "./zenodo";
import { cnllSourceGateway } from "./CNLL";
import { gitHubSourceGateway } from "./GitHub";
import { gitLabSourceGateway } from "./GitLab";

export const resolveAdapterFromSource = (
    source: DatabaseDataType.SourceRow
): PrimarySourceGateway | SecondarySourceGateway => {
    switch (source.kind) {
        case "HAL":
            return halSourceGateway;
        case "wikidata":
            return wikidataSourceGateway;
        case "ComptoirDuLibre":
            return comptoirDuLibreSourceGateway;
        case "CNLL":
            return cnllSourceGateway;
        case "Zenodo":
            return zenodoSourceGateway;
        case "GitHub":
            return gitHubSourceGateway;
        case "GitLab":
            return gitLabSourceGateway;
        case USER_INPUT_SOURCE_SLUG:
            throw new Error(
                `user_input is not a fetchable source — the gateway should not be resolved for slug "${source.slug}"`
            );
        default:
            const unreachableCase: never = source.kind;
            throw new Error(`Unreachable case: ${unreachableCase}`);
    }
};
