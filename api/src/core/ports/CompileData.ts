// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { SimilarSoftwareExternalData } from "./GetSoftwareExternalData";
import { SchemaOrganization } from "../adapters/dbApi/kysely/kysely.database";
import type { DatabaseDataType } from "./DbApiV2";
import type { Os, RuntimePlatform } from "../types";
import { CustomAttributes } from "../usecases/readWriteSillData/attributeTypes";

export type CompiledData<T extends "private" | "public"> = CompiledData.Software<T>[];

export namespace CompiledData {
    export type Software<T extends "private" | "public"> = T extends "private" ? Software.Private : Software.Public;

    export namespace Software {
        export type Common = {
            id: number;
            name: string;
            description: string;
            referencedSinceTime: number;
            updateTime: number;
            dereferencing:
                | {
                      reason?: string;
                      time: number;
                      lastRecommendedVersion?: string;
                  }
                | undefined;
            isStillInObservation: boolean;
            license: string;
            operatingSystems: Partial<Record<Os, boolean>>;
            runtimePlatforms: RuntimePlatform[];
            categories: string[];
            image: string | undefined;
            keywords: string[];
            customAttributes: CustomAttributes | null;
            serviceProviders: SchemaOrganization[];
            softwareExternalData: DatabaseDataType.SoftwareExternalDataRow | undefined;
            similarExternalSoftwares: SimilarSoftwareExternalData[];
            latestVersion:
                | {
                      semVer: string;
                      publicationTime: number;
                  }
                | undefined;
        };

        export type Public = Common & {
            userAndReferentCountByOrganization: Record<string, { userCount: number; referentCount: number }>;
            hasExpertReferent: boolean;
            instances: Instance[];
        };

        export type Private = Common & {
            addedByUserEmail: string;
            users: {
                organization: string;
                os: Os | undefined;
                serviceUrl: string | undefined;
                useCaseDescription: string;
                version: string;
            }[];
            referents: {
                email: string;
                organization: string;
                isExpert: boolean;
                serviceUrl: string | undefined;
                useCaseDescription: string;
            }[];
            instances: (Instance & { addedByUserEmail: string })[];
        };
    }

    export type Instance = {
        id: number;
        organization: string;
        targetAudience: string;
        publicUrl: string | undefined;
    };
}

export function compiledDataPrivateToPublic(compiledData: CompiledData<"private">): CompiledData<"public"> {
    return compiledData.map((software): CompiledData.Software<"public"> => {
        const {
            referents,
            users,
            instances,
            categories,
            dereferencing,
            description,
            customAttributes,
            id,
            isStillInObservation,
            keywords,
            license,
            image,
            name,
            referencedSinceTime,
            operatingSystems,
            runtimePlatforms,
            latestVersion,
            updateTime,
            softwareExternalData,
            similarExternalSoftwares,
            serviceProviders
        } = software;

        return {
            serviceProviders,
            categories,
            dereferencing,
            description,
            customAttributes,
            id,
            isStillInObservation,
            keywords,
            license,
            image,
            name,
            referencedSinceTime,
            operatingSystems,
            runtimePlatforms,
            latestVersion,
            updateTime,
            softwareExternalData,
            similarExternalSoftwares,
            "hasExpertReferent": referents.find(({ isExpert }) => isExpert) !== undefined,
            "userAndReferentCountByOrganization": (() => {
                const out: CompiledData.Software.Public["userAndReferentCountByOrganization"] = {};

                referents.forEach(referent => {
                    const entry = (out[referent.organization] ??= { "referentCount": 0, "userCount": 0 });
                    entry.referentCount++;
                });
                users.forEach(user => {
                    const entry = (out[user.organization] ??= { "referentCount": 0, "userCount": 0 });
                    entry.userCount++;
                });

                return out;
            })(),
            "instances": instances.map(({ addedByUserEmail, ...rest }) => rest)
        };
    });
}
