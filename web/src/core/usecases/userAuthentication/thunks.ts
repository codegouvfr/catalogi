// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { name, actions } from "./state";
import { apiUrl } from "urls";

export const protectedThunks = {
    initialize:
        () =>
        async (dispatch, getState, { sillApi }) => {
            const state = getState()[name];
            if (state.stateDescription === "ready" || state.isInitializing) return;
            dispatch(actions.initializationStarted());
            const currentUser = await sillApi.getCurrentUser();
            dispatch(actions.initialized({ currentUser: currentUser ?? null }));
        }
} satisfies Thunks;

export const thunks = {
    login: () => async () => {
        const currentUrl =
            window.location.pathname + window.location.search + window.location.hash;
        const redirectUrl = encodeURIComponent(`${window.location.origin}${currentUrl}`);
        window.location.href = `${apiUrl}/auth/login?redirectUrl=${redirectUrl}`;
    },
    logout: () => async () => {
        window.location.href = `${apiUrl}/auth/logout`;
    }
} satisfies Thunks;
