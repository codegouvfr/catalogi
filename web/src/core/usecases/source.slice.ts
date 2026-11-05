// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ApiTypes } from "api";
import { createSelector, createUsecaseActions } from "redux-clean-architecture";
import type { State as RootState, Thunks } from "../bootstrap";
import { id } from "tsafe";
import { z } from "zod";

export const name = "source";

export type State = State.NotReady | State.Ready;

export namespace State {
    export type NotReady = {
        stateDescription: "not initialized";
    };

    export type Ready = {
        stateDescription: "initialized";
        lookupSource: Omit<ApiTypes.Source, "configuration">;
    };
}

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({ stateDescription: "not initialized" }),
    reducers: {
        fetchLookupSourceStarted: state => state,
        fetchLookupSourceSucceeded: (
            _,
            action: { payload: { lookupSource: Omit<ApiTypes.Source, "configuration"> } }
        ) => ({
            stateDescription: "initialized",
            lookupSource: action.payload.lookupSource
        })
    }
});

const readyState = (rootState: RootState) => {
    const state = rootState[name];
    if (state.stateDescription !== "initialized") return;
    return state;
};

export const selectors = {
    main: createSelector(readyState, state => state?.lookupSource)
};

export const thunks = {};

export const protectedThunks = {
    initialize:
        () =>
        async (dispatch, _, { sillApi }) => {
            const lookupSource = await sillApi.getLookupSource();
            dispatch(actions.fetchLookupSourceSucceeded({ lookupSource }));
        }
} satisfies Thunks;
