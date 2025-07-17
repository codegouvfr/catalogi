// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Source } from "shared";
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
        mainSource: Source;
    };
}

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({ stateDescription: "not initialized" }),
    reducers: {
        fetchMainSourceStarted: state => state,
        fetchMainSourceSucceeded: (_, action: { payload: { mainSource: Source } }) => ({
            stateDescription: "initialized",
            mainSource: action.payload.mainSource
        })
    }
});

const readyState = (rootState: RootState) => {
    const state = rootState[name];
    if (state.stateDescription !== "initialized") return;
    return state;
};

export const selectors = {
    main: createSelector(readyState, state => state?.mainSource)
};

export const thunks = {};

export const protectedThunks = {
    initialize:
        () =>
        async (dispatch, _, { sillApi }) => {
            const mainSource = await sillApi.getMainSource();
            dispatch(actions.fetchMainSourceSucceeded({ mainSource }));
        }
} satisfies Thunks;
