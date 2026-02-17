// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { actions } from "./state";

export const thunks = {
    initialize:
        () =>
        async (...args): Promise<void> => {
            const [dispatch, getState, { sillApi, evtAction }] = args;

            const orgs = await sillApi.getSoftwareIdsByOrganisation();

            dispatch(
                actions.initialized({
                    stateDescription: "ready",
                    error: undefined,
                    list: orgs,
                    selected: undefined,
                    filtered: undefined
                })
            );
        }
} satisfies Thunks;
