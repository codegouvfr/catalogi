// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createUsecaseActions } from "redux-clean-architecture";
import { id } from "tsafe/id";
import { assert } from "tsafe/assert";
import { type State as SoftwareCatalogState } from "core/usecases/softwareCatalog";
import type { ApiTypes } from "api";

export const name = "softwareDetails";

export type State = State.NotReady | State.Ready | State.Error;

export namespace State {
    export type SimilarSoftwareNotRegistered =
        ApiTypes.Software.SimilarSoftware.SimilarSoftwareNotRegistered;

    export type NotReady = {
        stateDescription: "not ready";
        isInitializing: boolean;
    };

    export type Error = {
        stateDescription: "error";
        error: globalThis.Error;
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
        serviceProviders: ApiTypes.Organization[];
        logoUrl: string | undefined;
        authors: Array<ApiTypes.Person | ApiTypes.Organization>;
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
        dereferencing:
            | {
                  reason?: string;
                  time: number;
                  lastRecommendedVersion?: string;
              }
            | undefined;
        customAttributes: ApiTypes.CustomAttributes | undefined;
        supportedPlatforms: {
            isInstallableOnUserComputer: boolean | undefined;
            isAvailableAsMobileApp: boolean | undefined;
        };
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
                  registered: true;
                  software: SoftwareCatalogState.Software.External;
              }
            | SimilarSoftwareNotRegistered
        )[];
        programmingLanguages: string[];
        keywords: string[];
        applicationCategories: string[];
        referencePublications?: ApiTypes.ScholarlyArticle[];
        softwareType: ApiTypes.SoftwareType;
        identifiers: ApiTypes.Identifier[];
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
        initializationFailed: (
            _state,
            { payload }: { payload: { error: globalThis.Error } }
        ) => ({
            stateDescription: "error" as const,
            error: payload.error
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
