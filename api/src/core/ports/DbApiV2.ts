// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Database, DatabaseRowOutput } from "../adapters/dbApi/kysely/kysely.database";
import { TransformRepoToCleanedRow } from "../adapters/dbApi/kysely/kysely.utils";
import type {
    CreateUserParams,
    Instance,
    InstanceFormData,
    Software,
    SoftwareInList,
    UserWithId
} from "../usecases/readWriteSillData";
import type { OmitFromExisting } from "../utils";
import type { CompiledData } from "./CompileData";

import type { SoftwareExternalData } from "./GetSoftwareExternalData";
import type { AttributeDefinition } from "../usecases/readWriteSillData/attributeTypes";
import { SoftwareExternalDataOption } from "./GetSoftwareExternalDataOptions";

export type WithUserId = { userId: number };

// Other data, intrinsic are managed internally by the database
export type SoftwareExtrinsicRow = Pick<
    DatabaseDataType.SoftwareRow,
    | "name"
    | "description"
    | "license"
    | "logoUrl"
    | "dereferencing"
    | "isStillInObservation"
    | "customAttributes"
    | "softwareType"
    | "workshopUrls"
    | "categories"
    | "generalInfoMd"
    | "keywords"
    | "addedByUserId"
>;

export namespace DatabaseDataType {
    export type UserRow = TransformRepoToCleanedRow<DatabaseRowOutput.User>;
    export type SoftwareReferentRow = TransformRepoToCleanedRow<DatabaseRowOutput.SoftwareReferent>;
    export type SoftwareUsertRow = TransformRepoToCleanedRow<DatabaseRowOutput.SoftwareUsert>;
    export type InstanceRow = TransformRepoToCleanedRow<DatabaseRowOutput.Instance>;
    export type SoftwareRow = TransformRepoToCleanedRow<DatabaseRowOutput.Software>;
    export type SoftwareExternalDataRow = TransformRepoToCleanedRow<DatabaseRowOutput.SoftwareExternalData>;
    export type SimilarExternalSoftwareExternalDataRow =
        TransformRepoToCleanedRow<DatabaseRowOutput.SimilarExternalSoftwareExternalData>;
    export type SourceRow = TransformRepoToCleanedRow<DatabaseRowOutput.Source>;
}

export type SoftwareExtrinsicCreation = SoftwareExtrinsicRow &
    Pick<DatabaseDataType.SoftwareRow, "referencedSinceTime">;

export interface SoftwareRepository {
    getFullList: () => Promise<SoftwareInList[]>;
    getDetails: (softwareId: number) => Promise<Software | undefined>;
    create: (params: { software: SoftwareExtrinsicCreation }) => Promise<number>;
    update: (params: { softwareId: number; software: SoftwareExtrinsicRow }) => Promise<void>;
    getSoftwareIdByExternalIdAndSlug: (params: {
        externalId: string;
        sourceSlug: string;
    }) => Promise<number | undefined>;
    getBySoftwareId: (id: number) => Promise<DatabaseDataType.SoftwareRow | undefined>;
    getByName: (params: { softwareName: string }) => Promise<DatabaseDataType.SoftwareRow | undefined>;
    // Save = insert or update
    saveSimilarSoftwares: (
        params: {
            softwareId: number;
            softwareExternalDataItems: SoftwareExternalDataOption[];
        }[]
    ) => Promise<void>;
    getSimilarSoftwareExternalDataPks: (params: {
        softwareId: number;
    }) => Promise<{ sourceSlug: string; externalId: string; softwareId: number | undefined }[]>;
    countAddedByUser: (params: { userId: number }) => Promise<number>;
    getAllSillSoftwareExternalIds: (sourceSlug: string) => Promise<string[]>;
    unreference: (params: { softwareId: number; reason: string; time: number }) => Promise<void>;
}

export type PopulatedExternalData = DatabaseDataType.SoftwareExternalDataRow &
    Pick<DatabaseDataType.SourceRow, "url" | "kind" | "slug" | "priority">;

export interface SoftwareExternalDataRepository {
    saveMany: (
        params: Array<
            { sourceSlug: string; externalId: string; softwareId?: number } & Partial<SoftwareExternalDataOption>
        >
    ) => Promise<void>;
    update: (params: {
        sourceSlug: string;
        externalId: string;
        softwareId?: number;
        lastDataFetchAt?: Date;
        softwareExternalData: SoftwareExternalData;
    }) => Promise<void>;
    save: (params: { softwareExternalData: SoftwareExternalData; softwareId: number | undefined }) => Promise<void>; // TODO
    get: (params: {
        sourceSlug: string;
        externalId: string;
    }) => Promise<DatabaseDataType.SoftwareExternalDataRow | undefined>;
    getIds: (params: { minuteSkipSince?: number }) => Promise<
        {
            sourceSlug: string;
            externalId: string;
        }[]
    >;
    getBySoftwareId: (params: {
        softwareId: number;
    }) => Promise<DatabaseDataType.SoftwareExternalDataRow[] | undefined>;
    getAll: () => Promise<DatabaseDataType.SoftwareExternalDataRow[] | undefined>;
    delete: (params: { sourceSlug: string; externalId: string }) => Promise<boolean>;
    getOtherIdentifierIdsBySourceURL: (params: { sourceURL: string }) => Promise<Record<string, number> | undefined>;
}

export interface InstanceRepository {
    create: (
        params: {
            formData: InstanceFormData;
        } & WithUserId
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
    getAll: () => Promise<DatabaseDataType.SourceRow[]>;
    getByName: (params: { name: string }) => Promise<DatabaseDataType.SourceRow | undefined>;
    getMainSource: () => Promise<DatabaseDataType.SourceRow>;
    getWikidataSource: () => Promise<DatabaseDataType.SourceRow | undefined>;
}

export type Session = {
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

export interface SessionRepository {
    create: (params: { id: string; state: string; redirectUrl: string | null }) => Promise<void>;
    findByState: (state: string) => Promise<Session | undefined>;
    findById: (id: string) => Promise<Session | undefined>;
    update: (session: Session) => Promise<void>;
    deleteSessionsNotCompletedByUser: () => Promise<void>;
}

export interface AttributeDefinitionRepository {
    getAll: () => Promise<AttributeDefinition[]>;
    getByName: (name: string) => Promise<AttributeDefinition | undefined>;
}

export type DbApiV2 = {
    source: SourceRepository;
    software: SoftwareRepository;
    softwareExternalData: SoftwareExternalDataRepository;
    instance: InstanceRepository;
    user: UserRepository;
    softwareReferent: SoftwareReferentRepository;
    softwareUser: SoftwareUserRepository;
    session: SessionRepository;
    attributeDefinition: AttributeDefinitionRepository;
    getCompiledDataPrivate: () => Promise<CompiledData<"private">>;
};
