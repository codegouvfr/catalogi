// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Generated, JSONColumnType } from "kysely";
import { TransformRepoToRowOutput } from "./kysely.utils";

// from https://schema.org/ScholarlyArticle
export type ScholarlyArticle = {
    "@id": string;
    "@type": "ScholarlyArticle";
    identifiers: ArticleIdentifier[];
    headline?: string;
};

export type ArticleIdentifierOrigin = "doi" | "arxiv" | "HAL";

// from https://schema.org/PropertyValue
export interface ArticleIdentifier extends SchemaIdentifier {
    subjectOf: WebSite;
    additionalType: "Article";
}

export type OrganizationIdentifierOrigin = "wikidata" | "HAL";
export interface OrganizationIdentifer extends SchemaIdentifier {
    subjectOf: WebSite;
    additionalType: "Organization";
}

// from https://schema.org/Organization
export type SchemaOrganization = {
    "@type": "Organization";
    name: string;
    url?: string;
    identifiers?: SchemaIdentifier[];
    parentOrganizations?: SchemaOrganization[];
};

// from https://schema.org/Person
export type SchemaPerson = {
    "@type": "Person";
    name: string;
    identifiers?: SchemaIdentifier[];
    url?: string;
    affiliations?: SchemaOrganization[];
};

// from https://schema.org/WebSite
export type WebSite = {
    "@type": "Website";
    name: string; // Name of the website or database
    description?: string;
    url: URL; // Name of the website or database
    additionalType?: string; // Type of the database
};

// from https://schema.org/identifier & https://schema.org/PropertyValue
export type SchemaIdentifier = {
    "@type": "PropertyValue";
    name?: string; // Name of the property
    value: string; // Value of the property
    url?: string | URL; // Url to direct access to the element on the database
    valueReference?: string; // Value of the instance / database
    subjectOf?: WebSite; // Value of the instance / database
    additionalType?: string; // Organization | Article | Person | ...
};

export type Database = {
    users: UsersTable;
    software_referents: SoftwareReferentsTable;
    software_users: SoftwareUsersTable;
    instances: InstancesTable;
    softwares: SoftwaresTable;
    software_external_datas: SoftwareExternalDatasTable;
    softwares__similar_software_external_datas: SimilarExternalSoftwareExternalDataTable;
    sources: SourcesTable;
    user_sessions: SessionsTable;
};

type UsersTable = {
    id: Generated<number>;
    email: string;
    organization: string | null;
    about: string | null;
    isPublic: boolean;
    sub: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
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
    referencedSinceTime: Date;
    updateTime: Date;
};

type ExternalId = string;
export type ExternalDataOriginKind = "wikidata" | "HAL" | "ComptoirDuLibre" | "CNLL" | "Zenodo";
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

export type SoftwareExternalDatasTable = {
    externalId: ExternalId;
    sourceSlug: string;
    softwareId: number | null;
    developers: JSONColumnType<Array<SchemaOrganization | SchemaPerson>>;
    label: string | JSONColumnType<LocalizedString>;
    description: string | JSONColumnType<LocalizedString>;
    isLibreSoftware: boolean | null;
    logoUrl: string | null;
    websiteUrl: string | null;
    sourceUrl: string | null;
    documentationUrl: string | null;
    license: string | null;
    softwareVersion: string | null;
    keywords: JSONColumnType<string[]> | null;
    programmingLanguages: JSONColumnType<string[]> | null;
    applicationCategories: JSONColumnType<string[]> | null;
    referencePublications: JSONColumnType<ScholarlyArticle[]> | null;
    publicationTime: Date | null;
    identifiers: JSONColumnType<SchemaIdentifier[]> | null;
    lastDataFetchAt: Date | null;
    providers: JSONColumnType<Array<SchemaOrganization>> | null;
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
    referencedSinceTime: Date;
    updateTime: Date;
    dereferencing: JSONColumnType<{
        reason?: string;
        time: number;
        lastRecommendedVersion?: string;
    }> | null;
    isStillInObservation: boolean;
    doRespectRgaa: boolean | null;
    isFromFrenchPublicService: boolean;
    isPresentInSupportContract: boolean;
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

export namespace DatabaseRowOutput {
    export type User = TransformRepoToRowOutput<UsersTable>;
    export type SoftwareReferent = TransformRepoToRowOutput<SoftwareReferentsTable>;
    export type SoftwareUsert = TransformRepoToRowOutput<SoftwareUsersTable>;
    export type Instance = TransformRepoToRowOutput<InstancesTable>;
    export type Software = TransformRepoToRowOutput<SoftwaresTable>;
    export type SoftwareExternalData = TransformRepoToRowOutput<SoftwareExternalDatasTable>;
    export type SimilarExternalSoftwareExternalData =
        TransformRepoToRowOutput<SimilarExternalSoftwareExternalDataTable>;
    export type Source = TransformRepoToRowOutput<SourcesTable>;
}

type SessionsTable = {
    id: string;
    state: string;
    redirectUrl: string | null;
    userId: number | null;
    email: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    idToken: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    loggedOutAt: Date | null;
};

// ---------- compiled data ----------
// TODO DELETE ?
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
            wikidata: WikidataIdentifier | never[];
            sill: SILLIdentifier | never[];
            wikipedia: WikipediaIdentifier | never[];
            cnll: CNLLIdentifier | never[];
            framalibre: FramaLibreIdentifier | never[];
        };
        providers: Provider[];
        users: User[];
    };

    type CNLLIdentifier = {
        url: string;
    };

    type FramaLibreIdentifier = {
        slug: string;
        url: string;
    };

    type WikidataIdentifier = {
        id: string;
        url: string;
        data: string;
    };

    type SILLIdentifier = {
        id: number;
        url: string;
        i18n_url: {
            fr: string;
            en: string;
        };
    };

    type WikipediaIdentifier = {
        url: string;
        i18n_url: {
            fr: string;
            en: string;
        };
    };
}
