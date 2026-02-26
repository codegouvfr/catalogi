// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { LocalizedString } from "../../ports/GetSoftwareExternalData";
import { DatabaseDataType } from "../../ports/DbApiV2";
import {
    RepoMetadata,
    SchemaIdentifier,
    SchemaOrganization,
    SchemaPerson,
    ScholarlyArticle
} from "../../adapters/dbApi/kysely/kysely.database";
import { CustomAttributes } from "./attributeTypes";
import type { SoftwareExternalDataOption } from "../../ports/GetSoftwareExternalDataOptions";
import type { Os, RuntimePlatform, SimilarSoftware } from "../../types";

export type SoftwareInList = {
    id: number;
    name: string;
    description: string;
    image: string | undefined;
    latestVersion: { semVer: string | undefined; publicationTime: number | undefined } | undefined;
    addedTime: number;
    updateTime: number;
    applicationCategories: string[];
    keywords: string[];
    operatingSystems: Partial<Record<Os, boolean>>;
    runtimePlatforms: RuntimePlatform[];
    customAttributes: CustomAttributes | undefined;
    programmingLanguages: string[];
    authors: Array<{ name: string }>;
    userAndReferentCountByOrganization: Record<string, { userCount: number; referentCount: number }>;
    similarSoftwares: Array<{ softwareName: string | undefined; name: LocalizedString | undefined }>;
};

export type Software = {
    id: number;
    name: string;
    description: string;
    image: string | undefined;
    providers: SchemaOrganization[];
    latestVersion:
        | {
              semVer?: string;
              publicationTime?: number;
          }
        | undefined;
    addedTime: number;
    updateTime: number;
    dereferencing?:
        | {
              reason?: string;
              time: number;
              lastRecommendedVersion?: string;
          }
        | undefined;
    applicationCategories: string[];
    customAttributes: CustomAttributes | undefined;
    userAndReferentCountByOrganization: Record<string, { userCount: number; referentCount: number }>;
    authors: Array<SchemaPerson | SchemaOrganization>;
    url: string | undefined;
    codeRepositoryUrl: string | undefined;
    softwareHelp: string | undefined;
    license: string;
    externalId: string | undefined;
    sourceSlug: string | undefined;
    operatingSystems: Partial<Record<Os, boolean>>;
    runtimePlatforms: RuntimePlatform[];
    similarSoftwares: SimilarSoftware[];
    keywords: string[];
    programmingLanguages: string[];
    referencePublications?: ScholarlyArticle[];
    identifiers?: SchemaIdentifier[];
    repoMetadata?: RepoMetadata;
};

export type Source = DatabaseDataType.SourceRow;

export type CreateUserParams = {
    firstName?: string;
    lastName?: string;
    email: string;
    organization: string | null;
    declarations: (DeclarationFormData & { softwareName: string })[];
    isPublic: boolean;
    about: string | undefined;
    sub: string | null;
};

export type UserWithId = CreateUserParams & { id: number };

export type Instance = {
    id: number;
    mainSoftwareSillId: number;
    organization: string;
    targetAudience: string;
    instanceUrl: string | undefined;
    isPublic: boolean;
};

export type SoftwareFormData = {
    name: string;
    description: string;
    operatingSystems: Partial<Record<Os, boolean>>;
    runtimePlatforms: RuntimePlatform[];
    externalIdForSource: string | undefined;
    sourceSlug: string;
    license: string;
    similarSoftwareExternalDataItems: SoftwareExternalDataOption[];
    image: string | undefined;
    keywords: string[];
    customAttributes: CustomAttributes | undefined;
};

export type DeclarationFormData = DeclarationFormData.User | DeclarationFormData.Referent;

export namespace DeclarationFormData {
    export type User = {
        declarationType: "user";
        usecaseDescription: string;
        /** NOTE: undefined if the software is not of type desktop/mobile */
        os: Os | undefined;
        version: string;
        /** NOTE: Defined only when software is cloud */
        serviceUrl: string | undefined;
    };

    export type Referent = {
        declarationType: "referent";
        isTechnicalExpert: boolean;
        usecaseDescription: string;
        /** NOTE: Can be not undefined only if cloud */
        serviceUrl: string | undefined;
    };
}

export type InstanceFormData = {
    mainSoftwareSillId: number;
    organization: string;
    targetAudience: string;
    instanceUrl: string | undefined;
    isPublic: boolean;
};
