// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createUsecaseActions } from "redux-clean-architecture";
import { id } from "tsafe/id";
import { assert } from "tsafe/assert";
import type { LocalizedString } from "i18nifty";
import type { Language } from "shared";

export type WikidataEntry = {
    label: LocalizedString<Language>;
    description: LocalizedString<Language>;
    externalId: string;
};

type State = State.NotInitialized | State.Ready;

namespace State {
    export type NotInitialized = {
        stateDescription: "not ready";
        isInitializing: boolean;
    };

    export type Ready = {
        stateDescription: "ready";
        step: 1 | 2;
        /** Defined when update */
        preFillData:
            | {
                  type: "update";
                  instanceId: number;
                  mainSoftwareSillId: number;
                  organization: string;
                  instanceUrl: string | undefined;
                  isPublic: boolean;
                  targetAudience: string;
              }
            | {
                  type: "navigated from software form";
                  justRegisteredSoftwareSillId: number;
                  userOrganization: string | null;
              }
            | undefined;
        step1Data:
            | {
                  mainSoftwareSillId: number;
              }
            | undefined;
        isSubmitting: boolean;
        allSillSoftwares: {
            softwareName: string;
            softwareSillId: number;
            softwareDescription: string;
        }[];
    };
}

export const name = "instanceForm" as const;

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({
        stateDescription: "not ready",
        isInitializing: false
    }),
    reducers: {
        initializationStarted: state => {
            assert(state.stateDescription === "not ready");
            state.isInitializing = true;
        },
        initializationCompleted: (
            _state,
            {
                payload
            }: {
                payload: {
                    preFillData: State.Ready["preFillData"];
                    allSillSoftwares: {
                        softwareName: string;
                        softwareSillId: number;
                        softwareDescription: string;
                    }[];
                };
            }
        ) => {
            const { preFillData, allSillSoftwares } = payload;

            return {
                stateDescription: "ready",
                step: 1,
                preFillData,
                step1Data: undefined,
                isSubmitting: false,
                allSillSoftwares
            };
        },
        cleared: () => ({
            stateDescription: "not ready" as const,
            isInitializing: false
        }),
        step1Completed: (
            state,
            {
                payload
            }: {
                payload: {
                    step1Data: NonNullable<State.Ready["step1Data"]>;
                };
            }
        ) => {
            const { step1Data } = payload;

            assert(state.stateDescription === "ready");

            state.step1Data = step1Data;
            state.step = 2;
        },
        navigatedToPreviousStep: state => {
            assert(state.stateDescription === "ready");
            state.step--;
        },
        submissionStarted: state => {
            assert(state.stateDescription === "ready");
            state.isSubmitting = true;
        },
        formSubmitted: (
            _state,
            {
                payload: _payload
            }: {
                payload: {
                    softwareName: string;
                };
            }
        ) => {}
    }
});
