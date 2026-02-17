// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { State as RootState } from "core/bootstrap";
import { name } from "./state";
import { createSelector } from "redux-clean-architecture";
import { assert } from "tsafe/assert";

const readyState = (rootState: RootState) => {
    const state = rootState[name];

    if (state.stateDescription !== "ready") {
        return undefined;
    }

    return state;
};

const errorState = (rootState: RootState) => {
    const state = rootState[name];

    if (state.stateDescription !== "error") {
        return undefined;
    }

    return state;
};

const isReady = createSelector(readyState, state => state !== undefined);

const error = createSelector(errorState, state => state?.error);

const list = createSelector(readyState, readyState => readyState?.list);

const main = createSelector(isReady, list, error, (isReady, list, error) => {
    if (error) {
        return {
            isReady: false as const,
            error
        };
    }

    if (!isReady) {
        return {
            isReady: false as const
        };
    }

    assert(list !== undefined);

    return {
        isReady: true as const,
        list
    };
});

export const selectors = { main };
