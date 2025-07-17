// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createUsecaseActions } from "redux-clean-architecture";
import { id } from "tsafe/id";
import { assert } from "tsafe/assert";
import { type State as SoftwareCatalogState } from "core/usecases/softwareCatalog";
import type { Software, ServiceProvider, Catalogi, SoftwareType } from "shared";

export const name = "softwareDetails";

export type State = State.NotReady | State.Ready;

export namespace State {
    export type SimilarSoftwareNotInSill =
        Software.SimilarSoftware.SimilarSoftwareNotInSill;

    export type NotReady = {
        stateDescription: "not ready";
        isInitializing: boolean;
    };

    export type Ready = {
        stateDescription: "ready";
        software: Software;
        // undefined when not logged in
        userDeclaration:
            | {
                  isReferent: boolean;
                  isUser: boolean;
              }
            | undefined;
        isUnreferencingOngoing: boolean;
    };

    export type Software = {
        softwareId: number;
        softwareName: string;
        softwareDescription: string;
        serviceProviders: ServiceProvider[];
        logoUrl: string | undefined;
        authors: Array<Catalogi.Person | Catalogi.Organization>;
        officialWebsiteUrl: string | undefined;
        documentationUrl: string | undefined;
        codeRepositoryUrl: string | undefined;
        latestVersion:
            | {
                  semVer?: string;
                  publicationTime?: number;
              }
            | undefined;
        addedTime: number;
        versionMin: string | undefined;
        license: string;
        comptoirDuLibreServiceProviderCount: number;
        comptoirDuLibreServiceProviderUrl: string | undefined;
        annuaireCnllServiceProviders: {
            name: string;
            siren: string;
            url: string;
        }[];
        dereferencing:
            | {
                  reason?: string;
                  time: number;
                  lastRecommendedVersion?: string;
              }
            | undefined;
        comptoirDuLibreUrl: string | undefined;
        wikidataUrl: string | undefined;
        prerogatives: Record<SoftwareCatalogState.Prerogative, boolean | undefined>;
        userCount: number;
        referentCount: number;
        instances:
            | {
                  id: number;
                  organization: string;
                  instanceUrl: string | undefined;
                  targetAudience: string;
                  isPublic: boolean;
              }[]
            | undefined;
        similarSoftwares: (
            | {
                  isInSill: true;
                  software: SoftwareCatalogState.Software.External;
              }
            | SimilarSoftwareNotInSill
        )[];
        programmingLanguages: string[];
        keywords: string[];
        applicationCategories: string[];
        referencePublications?: Catalogi.ScholarlyArticle[];
        softwareType: SoftwareType;
        identifiers: Catalogi.Identification[];
    };
}

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({
        stateDescription: "not ready",
        isInitializing: false
    }),
    reducers: {
        initializationStarted: () => ({
            stateDescription: "not ready" as const,
            isInitializing: true
        }),
        initializationCompleted: (
            _state,
            {
                payload
            }: {
                payload: {
                    software: State.Software;
                    userDeclaration:
                        | {
                              isUser: boolean;
                              isReferent: boolean;
                          }
                        | undefined;
                };
            }
        ) => {
            const { software, userDeclaration } = payload;

            return {
                stateDescription: "ready",
                software,
                userDeclaration:
                    userDeclaration === undefined
                        ? undefined
                        : {
                              ...userDeclaration,
                              isRemovingRole: false
                          },
                isUnreferencingOngoing: false
            };
        },
        cleared: () => ({
            stateDescription: "not ready" as const,
            isInitializing: false
        }),
        unreferencingStarted: state => {
            assert(state.stateDescription === "ready");
            state.isUnreferencingOngoing = true;
        },
        unreferencingCompleted: (
            state,
            { payload }: { payload: { reason: string; time: number } }
        ) => {
            const { reason, time } = payload;

            assert(state.stateDescription === "ready");
            state.software.dereferencing = { reason, time };
            state.isUnreferencingOngoing = false;
        }
    }
});
