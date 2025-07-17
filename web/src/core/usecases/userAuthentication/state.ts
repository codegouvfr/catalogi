// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Agent } from "shared";
import { createUsecaseActions } from "redux-clean-architecture";
import { assert } from "tsafe/assert";
import { id } from "tsafe/id";
import { actions as usersAccountManagementActions } from "../userAccountManagement";

export const name = "userAuthentication";

export type State = State.NotInitialized | State.Ready;

export namespace State {
    export type NotInitialized = {
        stateDescription: "not initialized";
        isInitializing: boolean;
        currentAgent: null;
    };

    export type Ready = {
        stateDescription: "ready";
        currentAgent: Agent | null;
    };
}

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({
        stateDescription: "not initialized",
        currentAgent: null,
        isInitializing: false
    }),
    reducers: {
        initializationStarted: state => {
            assert(state.stateDescription === "not initialized");
        },
        initialized: (_, action: { payload: { agent: Agent | null } }) => ({
            stateDescription: "ready",
            currentAgent: action.payload.agent
        })
    },
    extraReducers: builder => {
        builder.addCase(
            usersAccountManagementActions.updateFieldCompleted,
            (state, action) => {
                if (!state.currentAgent) return state;
                if (action.payload.fieldName === "organization") {
                    return {
                        ...state,
                        currentAgent: {
                            ...state.currentAgent,
                            organization: action.payload.value
                        }
                    };
                }

                return {
                    ...state,
                    currentAgent: {
                        ...state.currentAgent,
                        about: action.payload.about,
                        isPublic: action.payload.isPublic
                    }
                };
            }
        );
    }
});
