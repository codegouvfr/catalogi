// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ApiTypes, TrpcRouterInput } from "api";
import { createSelector, createUsecaseActions } from "redux-clean-architecture";
import type { State as RootState, Thunks } from "../bootstrap";
import { id } from "tsafe";
import { protectedThunks as sourceProtectedThunks } from "./source.slice";
import { protectedThunks as externalDataOriginProtectedThunks } from "./externalDataOrigin/thunks";

export const name = "adminSources";

export type State = {
    isLoading: boolean;
    hasLoadFailed: boolean;
    isSaving: boolean;
    categories: ApiTypes.AdminSourceCategory[];
};

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({
        isLoading: false,
        hasLoadFailed: false,
        isSaving: false,
        categories: []
    }),
    reducers: {
        fetchStarted: state => {
            state.isLoading = true;
        },
        fetchSucceeded: (
            state,
            action: { payload: { categories: ApiTypes.AdminSourceCategory[] } }
        ) => {
            state.isLoading = false;
            state.hasLoadFailed = false;
            state.categories = action.payload.categories;
        },
        fetchFailed: state => {
            state.isLoading = false;
            state.hasLoadFailed = true;
        },
        saveStarted: state => {
            state.isSaving = true;
        },
        saveSettled: state => {
            state.isSaving = false;
        },
        // The software catalog reloads on it.
        categoriesReordered: () => {}
    }
});

const slice = (rootState: RootState) => rootState[name];

export const selectors = {
    main: createSelector(slice, state => state)
};

type Dispatch = Parameters<ReturnType<(typeof thunks)["fetch"]>>[0];
type SillApi = Parameters<ReturnType<(typeof thunks)["fetch"]>>[2]["sillApi"];

async function refetch(dispatch: Dispatch, sillApi: SillApi) {
    try {
        const categories = await sillApi.getAdminSources();
        dispatch(actions.fetchSucceeded({ categories }));
    } catch {
        dispatch(actions.fetchFailed());
    }
}

async function save(dispatch: Dispatch, sillApi: SillApi, run: () => Promise<unknown>) {
    dispatch(actions.saveStarted());
    try {
        await run();
        await refetch(dispatch, sillApi);
    } finally {
        dispatch(actions.saveSettled());
    }
}

export const thunks = {
    fetch:
        () =>
        async (dispatch, _, { sillApi }) => {
            dispatch(actions.fetchStarted());
            await refetch(dispatch, sillApi);
        },
    update:
        (params: TrpcRouterInput["updateSource"]) =>
        async (dispatch, _, { sillApi }) =>
            save(dispatch, sillApi, () => sillApi.updateSource(params)),
    setLookupSource:
        (params: TrpcRouterInput["setLookupSource"]) =>
        async (dispatch, _, { sillApi }) =>
            save(dispatch, sillApi, async () => {
                await sillApi.setLookupSource(params);
                // The software form searches the lookup source.
                await Promise.all([
                    dispatch(sourceProtectedThunks.initialize()),
                    dispatch(externalDataOriginProtectedThunks.initialize())
                ]);
            }),
    reorderCategories:
        (params: TrpcRouterInput["reorderSourceCategories"]) =>
        async (dispatch, _, { sillApi }) => {
            await save(dispatch, sillApi, () => sillApi.reorderSourceCategories(params));
            dispatch(actions.categoriesReordered());
        },
    checkConnection:
        (params: TrpcRouterInput["checkSourceConnection"]) =>
        async (...[, , { sillApi }]): Promise<ApiTypes.SourceConnectionCheckResult> =>
            sillApi.checkSourceConnection(params)
} satisfies Thunks;
