// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { assert } from "tsafe/assert";
import { name, actions } from "./state";
import { apiUrl } from "urls";

export const thunks = {
    initialize:
        (params: { email: string }) =>
        async (...args) => {
            const { email } = params;

            const [dispatch, getState, { sillApi }] = args;

            const state = getState();
            const { currentUser } = state.userAuthentication;
            {
                const userProfileState = state[name];
                assert(
                    userProfileState.stateDescription === "not ready",
                    "The clear function should have been called"
                );

                if (userProfileState.isInitializing) {
                    return;
                }
            }

            dispatch(actions.initializationStarted());

            if (!currentUser && !(await sillApi.getIsUserProfilePublic({ email }))) {
                window.location.href = `${apiUrl}/auth/login`;
                assert(false, "never");
            }

            const { user } = await sillApi.getUser({ email });

            assert(user !== undefined);

            const isHimself = currentUser ? currentUser.email === email : false;

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
