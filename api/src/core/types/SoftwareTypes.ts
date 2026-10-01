// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { LocalizedString } from "../ports/GetSoftwareExternalData";
import type {
    SchemaPerson,
    SchemaOrganization,
    SchemaIdentifier,
    ScholarlyArticle,
    RepoMetadata,
    SoftwareProtection,
    SoftwareProtections,
    Status
} from "../adapters/dbApi/kysely/kysely.database";

export type { SoftwareProtection, SoftwareProtections };
import type { CustomAttributes } from "../usecases/readWriteSillData/attributeTypes";
import type { Instance } from "../usecases/readWriteSillData/types";

export const osValues = ["windows", "linux", "mac", "android", "ios"] as const;

export type Os = (typeof osValues)[number];

export type RuntimePlatform = "cloud" | "mobile" | "desktop";

export type SoftwareVariant = "internal" | "external" | "public";

/** What clients may see/submit about a protection — audit fields stay server-side. */
export type SoftwareProtectionData = Pick<SoftwareProtection, "isProtected" | "reason">;

export type SoftwareProtectionsData = {
    statusChanging?: SoftwareProtectionData | undefined;
    edition?: SoftwareProtectionData | undefined;
};

export type SimilarSoftware = {
    externalId: string;
    sourceSlug: string;
    name: LocalizedString;
    description: LocalizedString;
    // null = license verification unavailable. Distinct from `false` (verified
    // non-libre). Mirrors SoftwareExternalDataOption.isLibreSoftware semantics.
    isLibreSoftware: boolean | null;
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
    similarSoftwares: SimilarSoftware[];
    repoMetadata?: RepoMetadata;
};

export type Software = SoftwareData & {
    variant: SoftwareVariant;
    id: number | undefined;
    externalId: string | undefined;
    sourceSlug: string | undefined;
    status: Status;
    statusHistory?: Status[];
    protections?: SoftwareProtectionsData | undefined;
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

export type SoftwareExternal = Omit<Software, "status" | "statusHistory"> & {
    variant: "external";
    externalId: string;
    sourceSlug: string;
    id: number | undefined;
    protections?: undefined;
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
