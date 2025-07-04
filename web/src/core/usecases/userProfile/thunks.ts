// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { assert } from "tsafe/assert";
import { name, actions } from "./state";

export const thunks = {
    initialize:
        (params: { email: string }) =>
        async (...args) => {
            const { email } = params;

            const [dispatch, getState, { sillApi, oidc }] = args;

            {
                const state = getState()[name];

                assert(
                    state.stateDescription === "not ready",
                    "The clear function should have been called"
                );

                if (state.isInitializing) {
                    return;
                }
            }

            dispatch(actions.initializationStarted());

            if (
                !oidc.isUserLoggedIn &&
                !(await sillApi.getIsUserProfilePublic({ email }))
            ) {
                await oidc.login({
                    doesCurrentHrefRequiresAuth: true
                });
                assert(false, "never");
            }

            const { user } = await sillApi.getUser({ email });

            assert(user !== undefined);

            const isHimself = !oidc.isUserLoggedIn
                ? false
                : (await sillApi.getCurrentUser()).email === email;

            dispatch(
                actions.initializationCompleted({
                    email,
                    about: user.about,
                    organization: user.organization,
                    declarations: user.declarations,
                    isHimself
                })
            );
        },
    clear:
        () =>
        (...args) => {
            const [dispatch, getState] = args;

            {
                const state = getState()[name];

                if (state.stateDescription === "not ready") {
                    return;
                }
            }

            dispatch(actions.cleared());
        }
} satisfies Thunks;
