// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createUsecaseActions } from "redux-clean-architecture";
import { id } from "tsafe/id";
import { assert } from "tsafe/assert";
import type { DeclarationFormData } from "shared";

export type State = State.NotInitialized | State.Ready;

export namespace State {
    export type NotInitialized = {
        stateDescription: "not ready";
        isInitializing: boolean;
    };

    export type Ready = {
        stateDescription: "ready";
        declarationType: "user" | "referent" | undefined;
        step: 1 | 2;
        isSubmitting: boolean;
        software: {
            logoUrl: string | undefined;
            softwareId: number;
            softwareName: string;
            referentCount: number;
            userCount: number;
            softwareType: "desktop/mobile" | "cloud" | "other";
        };
    };
}

export type FormData = FormData.User | FormData.Referent;

export namespace FormData {
    export type User = DeclarationFormData.User;
    export type Referent = DeclarationFormData.Referent;
}

export const name = "declarationForm";

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
            { payload }: { payload: { software: State.Ready["software"] } }
        ) => {
            const { software } = payload;

            return id<State.Ready>({
                stateDescription: "ready",
                declarationType: undefined,
                isSubmitting: false,
                step: 1,
                software
            });
        },
        cleared: () => ({
            stateDescription: "not ready" as const,
            isInitializing: false
        }),
        declarationTypeSet: (
            state,
            { payload }: { payload: { declarationType: State.Ready["declarationType"] } }
        ) => {
            const { declarationType } = payload;

            assert(state.stateDescription === "ready");

            assert(state.step === 1);

            state.step = 2;

            state.declarationType = declarationType;
        },
        navigatedToPreviousStep: state => {
            assert(state.stateDescription === "ready");
            assert(state.step === 2);

            state.step = 1;
        },
        submissionStarted: state => {
            assert(state.stateDescription === "ready");

            state.isSubmitting = true;
        },
        triggerRedirect: (
            _state,
            { payload: _payload }: { payload: { isFormSubmitted: boolean } }
        ) => {}
    }
});
