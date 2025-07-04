// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createUsecaseActions } from "redux-clean-architecture";
import { assert } from "tsafe/assert";
import { id } from "tsafe/id";
import { actions as usersAccountManagementActions } from "../userAccountManagement";
import { ApiTypes } from "api";

export const name = "userAuthentication";

export type State = State.NotInitialized | State.Ready;

export namespace State {
    export type NotInitialized = {
        stateDescription: "not initialized";
        isInitializing: boolean;
        currentUser: null;
    };

    export type Ready = {
        stateDescription: "ready";
        currentUser: ApiTypes.UserWithId | null;
    };
}

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({
        stateDescription: "not initialized",
        currentUser: null,
        isInitializing: false
    }),
    reducers: {
        initializationStarted: state => {
            assert(state.stateDescription === "not initialized");
        },
        initialized: (_, action: { payload: { user: ApiTypes.UserWithId | null } }) => ({
            stateDescription: "ready",
            currentUser: action.payload.user
        })
    },
    extraReducers: builder => {
        builder.addCase(
            usersAccountManagementActions.updateFieldCompleted,
            (state, action) => {
                if (!state.currentUser) return state;
                if (action.payload.fieldName === "organization") {
                    return {
                        ...state,
                        currentUser: {
                            ...state.currentUser,
                            organization: action.payload.value
                        }
                    };
                }

                return {
                    ...state,
                    currentUser: {
                        ...state.currentUser,
                        about: action.payload.about,
                        isPublic: action.payload.isPublic
                    }
                };
            }
        );
    }
});
