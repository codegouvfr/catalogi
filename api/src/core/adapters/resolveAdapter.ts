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
import { rorSourceGateway } from "./ror.org";
import { rnsrSourceGateway } from "./RNSR";
import { gitLabSourceGateway } from "./GitLab";
import { ExternalDataOriginKind } from "./dbApi/kysely/kysely.database";

export const resolveAdapterFromSource = (source: DatabaseDataType.SourceRow, feature?: Feature): SourceGateway => {
    return resolveAdapterFromSourceType(source.kind, feature);
};

export const filterSourceByFeature = (sources: DatabaseDataType.SourceRow[], feature: Feature) => {
    return sources.filter(source => {
        const gateway = resolveAdapterFromSourceType(source.kind);
        return Object.hasOwn(gateway, feature);
    });
};

export const resolveAdapterFromSourceType = (sourceType: ExternalDataOriginKind, feature?: Feature): SourceGateway => {
    switch (sourceType) {
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
        case "ROR":
            if (feature && !Object.hasOwn(rorSourceGateway, feature))
                throw new Error(`rorSourceGateway doesn't implemend ${feature}`);
            return rorSourceGateway;
        case "RNSR":
            if (feature && !Object.hasOwn(rnsrSourceGateway, feature))
                throw new Error(`rnsrSourceGateway doesn't implemend ${feature}`);
            return rnsrSourceGateway;
        default:
            const unreachableCase: never = sourceType;
            throw new Error(`Unreachable case: ${unreachableCase}`);
    }
};
