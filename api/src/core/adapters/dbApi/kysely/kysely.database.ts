// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Generated, JSONColumnType } from "kysely";
// Only allowed import on JSONColumnType
import { Catalogi } from "../../../../types/Catalogi";

// from https://schema.org/Organization
type SchemaOrganization = {
    "@type": "Organization";
    name: string;
    url: string | undefined;
    parentOrganizations?: SchemaOrganization[];
};

export type Database = {
    users: UsersTable;
    software_referents: SoftwareReferentsTable;
    software_users: SoftwareUsersTable;
    instances: InstancesTable;
    softwares: SoftwaresTable;
    software_external_datas: SoftwareExternalDatasTable;
    softwares__similar_software_external_datas: SimilarExternalSoftwareExternalDataTable;
    compiled_softwares: CompiledSoftwaresTable;
    sources: SourcesTable;
    sessions: SessionsTable;
};

type UsersTable = {
    id: Generated<number>;
    email: string;
    organization: string | null;
    about: string | null;
    isPublic: boolean;
    sub: string | null;
};

type Os = "windows" | "linux" | "mac" | "android" | "ios";

type SoftwareUsersTable = {
    softwareId: number;
    userId: number;
    useCaseDescription: string;
    os: Os | null;
    version: string;
    serviceUrl: string | null;
};

type SoftwareReferentsTable = {
    softwareId: number;
    userId: number;
    isExpert: boolean;
    useCaseDescription: string;
    serviceUrl: string | null;
};

type InstancesTable = {
    id: Generated<number>;
    mainSoftwareSillId: number;
    organization: string;
    targetAudience: string;
    instanceUrl: string | null;
    isPublic: boolean;
    addedByUserId: number;
    referencedSinceTime: number;
    updateTime: number;
};

type ExternalId = string;
type ExternalDataOriginKind = "wikidata" | "HAL";
type LocalizedString = Partial<Record<string, string>>;

type SimilarExternalSoftwareExternalDataTable = {
    softwareId: number;
    similarExternalId: ExternalId;
    sourceSlug: string;
};

type SourcesTable = {
    slug: string;
    kind: ExternalDataOriginKind;
    url: string;
    priority: number;
    description: JSONColumnType<LocalizedString> | null;
};

type SoftwareExternalDatasTable = {
    externalId: ExternalId;
    sourceSlug: string;
    softwareId: number | null;
    developers: JSONColumnType<
        {
            "@type": "Organization" | "Person";
            name: string;
            identifier?: string;
            url: string;
            affiliations?: SchemaOrganization[];
            parentOrganizations?: SchemaOrganization[];
        }[]
    >;
    label: string | JSONColumnType<LocalizedString>;
    description: string | JSONColumnType<LocalizedString>;
    isLibreSoftware: boolean;
    logoUrl: string | null;
    websiteUrl: string | null;
    sourceUrl: string | null;
    documentationUrl: string | null;
    license: string | null;
    softwareVersion: string | null;
    keywords: JSONColumnType<string[]> | null;
    programmingLanguages: JSONColumnType<string[]> | null;
    applicationCategories: JSONColumnType<string[]> | null;
    referencePublications: JSONColumnType<Catalogi.ScholarlyArticle[]> | null;
    publicationTime: Date | null;
    identifiers: JSONColumnType<Catalogi.Identification[]> | null;
};

type SoftwareType =
    | { type: "cloud" }
    | { type: "stack" }
    | {
          type: "desktop/mobile";
          os: Record<Os, boolean>;
      };

type SoftwaresTable = {
    id: Generated<number>;
    name: string;
    description: string;
    referencedSinceTime: number;
    updateTime: number;
    lastExtraDataFetchAt: Date | null;
    dereferencing: JSONColumnType<{
        reason?: string;
        time: number;
        lastRecommendedVersion?: string;
    }> | null;
    isStillInObservation: boolean;
    doRespectRgaa: boolean | null;
    isFromFrenchPublicService: boolean;
    isPresentInSupportContract: boolean;
    externalIdForSource: ExternalId | null;
    sourceSlug: string | null;
    comptoirDuLibreId: number | null;
    license: string;
    softwareType: JSONColumnType<SoftwareType>;
    versionMin: string | null;
    workshopUrls: JSONColumnType<string[]>;
    categories: JSONColumnType<string[]>;
    generalInfoMd: string | null;
    addedByUserId: number;
    logoUrl: string | null;
    keywords: JSONColumnType<string[]>;
};

type SessionsTable = {
    id: string;
    state: string;
    redirectUrl: string | null;
    userId: number | null;
    email: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

// ---------- compiled data ----------

export namespace PgComptoirDuLibre {
    type Provider = {
        id: number;
        url: string;
        name: string;
        type: string;
        external_resources: {
            website: string | null;
        };
    };

    type User = {
        id: number;
        url: string;
        name: string;
        type: string;
        external_resources: {
            website: string | null;
        };
    };

    export type Software = {
        id: number;
        logoUrl: string | undefined;
        keywords: string[] | undefined;
        created: string;
        modified: string;
        url: string;
        name: string;
        licence: string;
        external_resources: {
            website: string | null;
            repository: string | null;
        };
        providers: Provider[];
        users: User[];
    };
}

type ServiceProvider = {
    name: string;
    website?: string;
    cdlUrl?: string;
    cnllUrl?: string;
    siren?: string;
};

type CompiledSoftwaresTable = {
    softwareId: number;
    serviceProviders: JSONColumnType<ServiceProvider[]>;
    comptoirDuLibreSoftware: JSONColumnType<PgComptoirDuLibre.Software> | null;
    annuaireCnllServiceProviders: JSONColumnType<
        {
            name: string;
            siren: string;
            url: string;
        }[]
    > | null;
    latestVersion: JSONColumnType<{
        semVer: string;
        publicationTime: number;
    }> | null;
};
