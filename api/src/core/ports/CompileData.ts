// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ServiceProvider } from "shared";
import type { Db } from "./DbApi";
import { SimilarSoftwareExternalData, SoftwareExternalData } from "./GetSoftwareExternalData";
import type { ComptoirDuLibre } from "./ComptoirDuLibreApi";

export type CompileData = (params: {
    db: Db;
    getCachedSoftware: ((params: { sillSoftwareId: number }) => CompileData.PartialSoftware | undefined) | undefined;
}) => Promise<CompiledData<"private">>;

export namespace CompileData {
    export type PartialSoftware = Pick<
        CompiledData.Software<"private">,
        "softwareExternalData" | "latestVersion" | "similarExternalSoftwares"
    > & {
        comptoirDuLibreSoftware:
            | {
                  id: number;
                  logoUrl: string | undefined;
                  keywords: string[] | undefined;
              }
            | undefined;
        instances: Pick<CompiledData.Instance, "id">[];
    };
}

export type CompiledData<T extends "private" | "public"> = CompiledData.Software<T>[];

export namespace CompiledData {
    export type Software<T extends "private" | "public"> = T extends "private" ? Software.Private : Software.Public;

    export namespace Software {
        export type Common = Pick<
            Db.SoftwareRow,
            | "id"
            | "name"
            | "description"
            | "referencedSinceTime"
            | "updateTime"
            | "dereferencing"
            | "isStillInObservation"
            | "doRespectRgaa"
            | "isFromFrenchPublicService"
            | "isPresentInSupportContract"
            | "license"
            | "softwareType"
            | "versionMin"
            | "workshopUrls"
            | "categories"
            | "generalInfoMd"
            | "logoUrl"
            | "keywords"
            | "externalId"
            | "sourceSlug"
        > & {
            serviceProviders: ServiceProvider[];
            softwareExternalData: SoftwareExternalData | undefined;
            similarExternalSoftwares: SimilarSoftwareExternalData[];
            comptoirDuLibreSoftware:
                | (ComptoirDuLibre.Software & { logoUrl: string | undefined; keywords: string[] | undefined })
                | undefined;
            annuaireCnllServiceProviders:
                | {
                      name: string;
                      siren: string;
                      url: string;
                  }[]
                | undefined;
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
            addedByAgentEmail: string;
            users: (Pick<Db.AgentRow, "organization"> &
                Pick<Db.SoftwareUserRow, "os" | "serviceUrl" | "useCaseDescription" | "version">)[];
            referents: (Pick<Db.AgentRow, "email" | "organization"> &
                Pick<Db.SoftwareReferentRow, "isExpert" | "serviceUrl" | "useCaseDescription">)[];
            instances: (Instance & { addedByAgentEmail: string })[];
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
            annuaireCnllServiceProviders,
            categories,
            comptoirDuLibreSoftware,
            dereferencing,
            description,
            doRespectRgaa,
            generalInfoMd,
            id,
            isFromFrenchPublicService,
            isPresentInSupportContract,
            isStillInObservation,
            keywords,
            license,
            logoUrl,
            name,
            referencedSinceTime,
            softwareType,
            latestVersion,
            updateTime,
            versionMin,
            workshopUrls,
            softwareExternalData,
            similarExternalSoftwares,
            serviceProviders
        } = software;

        return {
            serviceProviders,
            annuaireCnllServiceProviders,
            categories,
            comptoirDuLibreSoftware,
            dereferencing,
            description,
            doRespectRgaa,
            generalInfoMd,
            id,
            isFromFrenchPublicService,
            isPresentInSupportContract,
            isStillInObservation,
            keywords,
            license,
            logoUrl,
            name,
            referencedSinceTime,
            softwareType,
            latestVersion,
            updateTime,
            versionMin,
            workshopUrls,
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
            "instances": instances.map(({ addedByAgentEmail, ...rest }) => rest)
        };
    });
}
