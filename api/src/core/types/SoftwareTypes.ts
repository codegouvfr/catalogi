// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { LocalizedString } from "../ports/GetSoftwareExternalData";
import type {
    SchemaPerson,
    SchemaOrganization,
    SchemaIdentifier,
    ScholarlyArticle
} from "../adapters/dbApi/kysely/kysely.database";
import type { CustomAttributes } from "../usecases/readWriteSillData/attributeTypes";
import type { Instance } from "../usecases/readWriteSillData/types";

export type Os = "windows" | "linux" | "mac" | "android" | "ios";

export type RuntimePlatform = "cloud" | "mobile" | "desktop";

export type Dereferencing = {
    reason: string | undefined;
    time: string;
    lastRecommendedVersion: string | undefined;
};

export type SimilarSoftware = {
    externalId: string;
    sourceSlug: string;
    name: LocalizedString;
    description: LocalizedString;
    isLibreSoftware: boolean | undefined;
    isInCatalogi: boolean;
    softwareId: number | undefined;
};

export type SoftwareData = {
    addedTime: string;
    updateTime: string;
    name: LocalizedString;
    description: LocalizedString | undefined;
    image: string | undefined;
    url: string | undefined;
    codeRepositoryUrl: string | undefined;
    softwareHelp: string | undefined;
    dateCreated: string | undefined;
    latestVersion:
        | {
              version: string | undefined;
              releaseDate: string | undefined;
          }
        | undefined;
    keywords: string[];
    applicationCategories: string[];
    programmingLanguages: string[];
    operatingSystems: Record<Os, boolean> | undefined;
    runtimePlatforms: RuntimePlatform[];
    authors: Array<SchemaPerson | SchemaOrganization>;
    providers: Array<SchemaOrganization>;
    license: string | undefined;
    isLibreSoftware: boolean | undefined;
    referencePublications: ScholarlyArticle[];
    identifiers: SchemaIdentifier[];
    sameAs: SimilarSoftware[];
};

export type SoftwareInternal = SoftwareData & {
    id: number;
    dereferencing: Dereferencing | undefined;
    customAttributes: CustomAttributes | undefined;
};

export type SoftwareExternal = SoftwareData & {
    externalId: string;
    sourceSlug: string;
    id: number | undefined;
};

export type SoftwarePublic = SoftwareInternal & {
    userAndReferentCountByOrganization: Record<
        string,
        {
            userCount: number;
            referentCount: number;
        }
    >;
    hasExpertReferent: boolean;
    instances: Instance[];
};
