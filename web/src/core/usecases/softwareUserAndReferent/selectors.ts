// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { State as RootState } from "core/bootstrap";
import { createSelector } from "redux-clean-architecture";
import { name } from "./state";
import { assert } from "tsafe/assert";

const readyState = (rootState: RootState) => {
    const state = rootState[name];

    if (state.stateDescription === "not ready") {
        return undefined;
    }

    return state;
};

const isReady = createSelector(readyState, readyState => readyState !== undefined);
const softwareId = createSelector(readyState, readyState => readyState?.softwareId);
const softwareName = createSelector(readyState, readyState => readyState?.softwareName);
const logoUrl = createSelector(readyState, readyState => readyState?.logoUrl);
const users = createSelector(readyState, readyState => readyState?.users);
const referents = createSelector(readyState, readyState => readyState?.referents);

const main = createSelector(
    isReady,
    softwareId,
    softwareName,
    logoUrl,
    users,
    referents,
    (isReady, softwareId, softwareName, logoUrl, users, referents) => {
        if (!isReady) {
            return {
                isReady: false as const
            };
        }

        assert(softwareId !== undefined);
        assert(softwareName !== undefined);
        assert(users !== undefined);
        assert(referents !== undefined);

        return {
            isReady: true as const,
            softwareId,
            softwareName,
            logoUrl,
            users,
            referents
        };
    }
);

export const selectors = { main };
