// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ApiTypes, TrpcRouterInput } from "api";
import { createSelector, createUsecaseActions } from "redux-clean-architecture";
import type { State as RootState, Thunks } from "../bootstrap";
import { id } from "tsafe";

export const name = "adminAttributes";

export type State = {
    isLoading: boolean;
    isSaving: boolean;
    definitions: ApiTypes.AttributeDefinition[];
};

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({
        isLoading: false,
        isSaving: false,
        definitions: []
    }),
    reducers: {
        fetchStarted: state => {
            state.isLoading = true;
        },
        fetchSucceeded: (
            state,
            action: { payload: { definitions: ApiTypes.AttributeDefinition[] } }
        ) => {
            state.isLoading = false;
            state.definitions = action.payload.definitions;
        },
        fetchFailed: state => {
            state.isLoading = false;
        },
        saveStarted: state => {
            state.isSaving = true;
        },
        saveSettled: state => {
            state.isSaving = false;
        }
    }
});

const slice = (rootState: RootState) => rootState[name];

export const selectors = {
    main: createSelector(slice, state => state)
};

async function refetch(
    dispatch: Parameters<ReturnType<(typeof thunks)["fetch"]>>[0],
    sillApi: Parameters<ReturnType<(typeof thunks)["fetch"]>>[2]["sillApi"]
) {
    try {
        const definitions = await sillApi.getAttributeDefinitions();
        dispatch(actions.fetchSucceeded({ definitions }));
    } catch {
        dispatch(actions.fetchFailed());
    }
}

export const thunks = {
    fetch:
        () =>
        async (dispatch, _, { sillApi }) => {
            dispatch(actions.fetchStarted());
            await refetch(dispatch, sillApi);
        },
    create:
        (params: TrpcRouterInput["createAttributeDefinition"]) =>
        async (dispatch, _, { sillApi }) => {
            dispatch(actions.saveStarted());
            try {
                await sillApi.createAttributeDefinition(params);
                await refetch(dispatch, sillApi);
            } finally {
                dispatch(actions.saveSettled());
            }
        },
    update:
        (params: TrpcRouterInput["updateAttributeDefinition"]) =>
        async (dispatch, _, { sillApi }) => {
            dispatch(actions.saveStarted());
            try {
                await sillApi.updateAttributeDefinition(params);
                await refetch(dispatch, sillApi);
            } finally {
                dispatch(actions.saveSettled());
            }
        }
} satisfies Thunks;
