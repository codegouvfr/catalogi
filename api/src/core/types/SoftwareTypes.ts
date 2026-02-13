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

export type SoftwareVariant = "internal" | "external" | "public";

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
    description: LocalizedString;
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
    operatingSystems: Record<Os, boolean>;
    runtimePlatforms: RuntimePlatform[];
    authors: Array<SchemaPerson | SchemaOrganization>;
    providers: Array<SchemaOrganization>;
    license: string | undefined;
    isLibreSoftware: boolean | undefined;
    referencePublications: ScholarlyArticle[];
    identifiers: SchemaIdentifier[];
    sameAs: SimilarSoftware[];
};

export type Software = SoftwareData & {
    variant: SoftwareVariant;
    id: number | undefined;
    externalId: string | undefined;
    sourceSlug: string | undefined;
    dereferencing: Dereferencing | undefined;
    customAttributes: CustomAttributes | undefined;
    userAndReferentCountByOrganization:
        | Record<
              string,
              {
                  userCount: number;
                  referentCount: number;
              }
          >
        | undefined;
    hasExpertReferent: boolean | undefined;
    instances: Instance[] | undefined;
};

export type SoftwareInternal = Software & {
    variant: "internal";
    id: number;
    externalId: undefined;
    sourceSlug: undefined;
};

export type SoftwareExternal = Software & {
    variant: "external";
    externalId: string;
    sourceSlug: string;
    id: number | undefined;
    dereferencing: undefined;
    customAttributes: undefined;
    userAndReferentCountByOrganization: undefined;
    hasExpertReferent: undefined;
    instances: undefined;
};

export type SoftwarePublic = Software & {
    variant: "public";
    id: number;
    userAndReferentCountByOrganization: Record<
        string,
        {
            userCount: number;
            referentCount: number;
        }
    >;
    hasExpertReferent: true | false;
    instances: Instance[];
};
