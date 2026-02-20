// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { LocalizedString, SimilarSoftwareExternalData } from "../../ports/GetSoftwareExternalData";
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
import type { Os, RuntimePlatform } from "../../types";

export type SoftwareInList = {
    id: number;
    softwareName: string;
    softwareDescription: string;
    logoUrl: string | undefined;
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
    similarSoftwares: Array<{ softwareName: string | undefined; label: LocalizedString | undefined }>;
};

export type Software = {
    logoUrl: string | undefined;
    softwareId: number;
    softwareName: string;
    softwareDescription: string;
    serviceProviders: SchemaOrganization[];
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
    officialWebsiteUrl: string | undefined;
    codeRepositoryUrl: string | undefined;
    documentationUrl: string | undefined;
    license: string;
    externalId: string | undefined;
    sourceSlug: string | undefined;
    operatingSystems: Partial<Record<Os, boolean>>;
    runtimePlatforms: RuntimePlatform[];
    similarSoftwares: Software.LegacySimilarSoftware[];
    keywords: string[];
    programmingLanguages: string[];
    referencePublications?: ScholarlyArticle[];
    identifiers?: SchemaIdentifier[];
    repoMetadata?: RepoMetadata;
};

export type Source = DatabaseDataType.SourceRow;

export namespace Software {
    export type LegacySimilarSoftware =
        | LegacySimilarSoftware.SimilarSoftwareNotRegistered
        | LegacySimilarSoftware.SimilarRegisteredSoftware;

    export namespace LegacySimilarSoftware {
        export type SimilarSoftwareNotRegistered = {
            registered: false;
            sourceSlug: string;
            externalId: string;
            isLibreSoftware: boolean | undefined;
            label: LocalizedString;
            description: LocalizedString;
        };

        export type SimilarRegisteredSoftware = {
            registered: true;
            softwareId: number;
            softwareName: string;
            softwareDescription: string;
        } & SimilarSoftwareExternalData;
    }
}

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
    softwareName: string;
    softwareDescription: string;
    operatingSystems: Partial<Record<Os, boolean>>;
    runtimePlatforms: RuntimePlatform[];
    externalIdForSource: string | undefined;
    sourceSlug: string;
    softwareLicense: string;
    similarSoftwareExternalDataItems: SoftwareExternalDataOption[];
    softwareLogoUrl: string | undefined;
    softwareKeywords: string[];
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

/* Obselete data for Compile Data : TODO Remove that */

export type ServiceProvider = {
    name: string;
    website?: string;
    cdlUrl?: string;
    cnllUrl?: string;
    siren?: string;
};
