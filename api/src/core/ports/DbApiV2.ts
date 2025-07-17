// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Database } from "../adapters/dbApi/kysely/kysely.database";
import type {
    CreateUserParams,
    Instance,
    InstanceFormData,
    ServiceProvider,
    Software,
    SoftwareFormData,
    Source,
    UserWithId
} from "../usecases/readWriteSillData";
import type { OmitFromExisting } from "../utils";
import type { CompiledData } from "./CompileData";
import { ComptoirDuLibre } from "./ComptoirDuLibreApi";

import type { SoftwareExternalData } from "./GetSoftwareExternalData";

export type WithuserId = { userId: number };

type GetSoftwareFilters = {
    onlyIfUpdatedMoreThan3HoursAgo?: true;
};

export interface SoftwareRepository {
    create: (
        params: {
            formData: SoftwareFormData;
        } & WithuserId
    ) => Promise<number>;
    update: (
        params: {
            softwareSillId: number;
            formData: SoftwareFormData;
        } & WithuserId
    ) => Promise<void>;
    updateLastExtraDataFetchAt: (params: { softwareId: number }) => Promise<void>;
    getAll: (filters?: GetSoftwareFilters) => Promise<Software[]>;
    getById: (id: number) => Promise<Software | undefined>;
    getSoftwareIdByExternalIdAndSlug: (params: {
        externalId: string;
        sourceSlug: string;
    }) => Promise<number | undefined>;
    getByIdWithLinkedSoftwaresExternalIds: (id: number) => Promise<
        | {
              software: Software;
              similarSoftwaresExternalIds: string[];
          }
        | undefined
    >;
    getByName: (name: string) => Promise<Software | undefined>;
    countAddedByUser: (params: { userId: number }) => Promise<number>;
    getAllSillSoftwareExternalIds: (sourceSlug: string) => Promise<string[]>;
    unreference: (params: { softwareId: number; reason: string; time: number }) => Promise<void>;
}

export interface SoftwareExternalDataRepository {
    save: (params: { softwareExternalData: SoftwareExternalData; softwareId: number | undefined }) => Promise<void>;
}

type CnllPrestataire = {
    name: string;
    siren: string;
    url: string;
};

export type OtherSoftwareExtraData = {
    softwareId: number;
    serviceProviders: ServiceProvider[];
    comptoirDuLibreSoftware: ComptoirDuLibre.Software | null;
    annuaireCnllServiceProviders: CnllPrestataire[] | null;
    latestVersion: { semVer: string; publicationTime: number } | null;
};

export interface OtherSoftwareExtraDataRepository {
    save: (otherSoftwareExtraData: OtherSoftwareExtraData) => Promise<void>;
    getBySoftwareId: (softwareId: number) => Promise<OtherSoftwareExtraData | undefined>;
}

export interface InstanceRepository {
    create: (
        params: {
            formData: InstanceFormData;
        } & WithuserId
    ) => Promise<number>;
    update: (params: { formData: InstanceFormData; instanceId: number }) => Promise<void>;
    countAddedByUser: (params: { userId: number }) => Promise<number>;
    getAll: () => Promise<Instance[]>;
}

export type DbUser = {
    id: number;
    sub: string | null;
    firstName?: string;
    lastName?: string;
    email: string;
    organization: string | null;
    about: string | undefined;
    isPublic: boolean;
};

export interface UserRepository {
    add: (user: OmitFromExisting<DbUser, "id">) => Promise<number>;
    update: (user: DbUser & Partial<CreateUserParams>) => Promise<void>;
    remove: (userId: number) => Promise<void>;
    getByEmail: (email: string) => Promise<UserWithId | undefined>;
    getBySub: (sub: string) => Promise<UserWithId | undefined>;
    getAll: () => Promise<UserWithId[]>;
    countAll: () => Promise<number>;
    getAllOrganizations: () => Promise<string[]>;
    getBySessionId: (sessionId: string) => Promise<UserWithId | undefined>;
}

export interface SoftwareReferentRepository {
    add: (params: Database["software_referents"]) => Promise<void>;
    remove: (params: { softwareId: number; userId: number }) => Promise<void>;
    countSoftwaresForUser: (params: { userId: number }) => Promise<number>;
    getTotalCount: () => Promise<number>;
}

export interface SoftwareUserRepository {
    add: (params: Database["software_users"]) => Promise<void>;
    remove: (params: { softwareId: number; userId: number }) => Promise<void>;
    countSoftwaresForUser: (params: { userId: number }) => Promise<number>;
}

export interface SourceRepository {
    getMainSource: () => Promise<Source>;
    getWikidataSource: () => Promise<Source | undefined>;
}

export type Session = {
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
    loggedOutAt: Date | null;
};

export interface SessionRepository {
    create: (params: { id: string; state: string; redirectUrl: string | null }) => Promise<void>;
    findByState: (state: string) => Promise<Session | undefined>;
    findById: (id: string) => Promise<Session | undefined>;
    update: (session: Session) => Promise<void>;
    deleteSessionsNotCompletedByUser: () => Promise<void>;
}

export type DbApiV2 = {
    source: SourceRepository;
    software: SoftwareRepository;
    softwareExternalData: SoftwareExternalDataRepository;
    otherSoftwareExtraData: OtherSoftwareExtraDataRepository;
    instance: InstanceRepository;
    user: UserRepository;
    softwareReferent: SoftwareReferentRepository;
    softwareUser: SoftwareUserRepository;
    session: SessionRepository;
    getCompiledDataPrivate: () => Promise<CompiledData<"private">>;
};
