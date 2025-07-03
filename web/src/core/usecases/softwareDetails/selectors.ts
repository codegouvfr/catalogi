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

const isReady = createSelector(readyState, state => state !== undefined);

const software = createSelector(readyState, readyState => readyState?.software);

const userDeclaration = createSelector(readyState, state => state?.userDeclaration);

const isUnreferencingOngoing = createSelector(
    readyState,
    state => state?.isUnreferencingOngoing
);

const main = createSelector(
    isReady,
    software,
    userDeclaration,
    isUnreferencingOngoing,
    (isReady, software, userDeclaration, isUnreferencingOngoing) => {
        if (!isReady) {
            return {
                isReady: false as const
            };
        }

        assert(software !== undefined);
        assert(isUnreferencingOngoing !== undefined);

        return {
            isReady: true as const,
            software,
            userDeclaration,
            isUnreferencingOngoing
        };
    }
);

export const selectors = { main };
