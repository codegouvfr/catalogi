// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Feature, SourceGateway } from "../ports/SourceGateway";
import { DatabaseDataType } from "../ports/DbApiV2";
import { halSourceGateway } from "./hal";
import { wikidataSourceGateway } from "./wikidata";
import { comptoirDuLibreSourceGateway } from "./comptoirDuLibre";
import { zenodoSourceGateway } from "./zenodo";
import { cnllSourceGateway } from "./CNLL";
import { gitHubSourceGateway } from "./GitHub";
import { gitLabSourceGateway } from "./GitLab";

export const resolveAdapterFromSource = (source: DatabaseDataType.SourceRow, feature?: Feature): SourceGateway => {
    switch (source.kind) {
        case "HAL":
            if (feature && !Object.hasOwn(halSourceGateway, feature))
                throw new Error(`halSourceGateway doesn't implemend ${feature}`);
            return halSourceGateway;
        case "wikidata":
            if (feature && !Object.hasOwn(wikidataSourceGateway, feature))
                throw new Error(`wikidataSourceGateway doesn't implemend ${feature}`);
            return wikidataSourceGateway;
        case "ComptoirDuLibre":
            if (feature && !Object.hasOwn(comptoirDuLibreSourceGateway, feature))
                throw new Error(`comptoirDuLibreSourceGateway doesn't implemend ${feature}`);
            return comptoirDuLibreSourceGateway;
        case "CNLL":
            if (feature && !Object.hasOwn(cnllSourceGateway, feature))
                throw new Error(`cnllSourceGateway doesn't implemend ${feature}`);
            return cnllSourceGateway;
        case "Zenodo":
            if (feature && !Object.hasOwn(zenodoSourceGateway, feature))
                throw new Error(`zenodoSourceGateway doesn't implemend ${feature}`);
            return zenodoSourceGateway;
        case "GitHub":
            if (feature && !Object.hasOwn(gitHubSourceGateway, feature))
                throw new Error(`gitHubSourceGateway doesn't implemend ${feature}`);
            return gitHubSourceGateway;
        case "GitLab":
            if (feature && !Object.hasOwn(gitLabSourceGateway, feature))
                throw new Error(`gitLabSourceGateway doesn't implemend ${feature}`);
            return gitLabSourceGateway;
        default:
            const unreachableCase: never = source.kind;
            throw new Error(`Unreachable case: ${unreachableCase}`);
    }
};
