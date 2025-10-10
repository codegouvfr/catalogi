// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ApiTypes } from "api";
import { createSelector, createUsecaseActions } from "redux-clean-architecture";
import type { State as RootState, Thunks } from "../bootstrap";
import { id } from "tsafe";

export const name = "uiConfig";

export type State = State.NotReady | State.Ready;

export namespace State {
    export type NotReady = {
        stateDescription: "not initialized";
    };

    export type Ready = {
        stateDescription: "initialized";
        uiConfig: ApiTypes.UiConfig;
        attributeDefinitions: ApiTypes.AttributeDefinition[];
    };
}

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({ stateDescription: "not initialized" }),
    reducers: {
        fetchUiConfigStarted: state => state,
        fetchUiConfigSucceeded: (
            _,
            action: {
                payload: {
                    uiConfig: ApiTypes.UiConfig;
                    attributeDefinitions: ApiTypes.AttributeDefinition[];
                };
            }
        ) => ({
            stateDescription: "initialized",
            uiConfig: action.payload.uiConfig,
            attributeDefinitions: action.payload.attributeDefinitions
        })
    }
});

const readyState = (rootState: RootState) => {
    const state = rootState[name];
    if (state.stateDescription === "initialized") return state;
};

export const selectors = {
    main: createSelector(readyState, state =>
        state?.stateDescription === "initialized"
            ? {
                  uiConfig: state.uiConfig,
                  attributeDefinitions: state.attributeDefinitions
              }
            : undefined
    )
};

export const thunks = {};

export const protectedThunks = {
    initialize:
        () =>
        async (dispatch, _, { sillApi }) => {
            const response = await sillApi.getUiConfig();
            dispatch(actions.fetchUiConfigSucceeded(response));
        }
} satisfies Thunks;
