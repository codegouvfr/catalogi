// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { assert } from "tsafe/assert";
import { name, actions } from "./state";

export const protectedThunks = {
    initialize:
        () =>
        async (dispatch, getState, { sillApi, oidc }) => {
            console.log("OIDC : is user logged in ?", oidc.isUserLoggedIn);
            if (!oidc.isUserLoggedIn) return;
            const state = getState()[name];
            if (state.stateDescription === "ready" || state.isInitializing) return;
            dispatch(actions.initializationStarted());
            const currentUser = await sillApi.getCurrentUser();
            const { user } = await sillApi.getUser({ email: currentUser.email });
            dispatch(actions.initialized({ user }));
        }
} satisfies Thunks;

export const thunks = {
    getIsUserLoggedIn:
        () =>
        (...args): boolean => {
            const [, , { oidc }] = args;
            return oidc.isUserLoggedIn;
        },
    login:
        (params: { doesCurrentHrefRequiresAuth: boolean }) =>
        (...args): Promise<never> => {
            const { doesCurrentHrefRequiresAuth } = params;

            const [, , { oidc }] = args;

            assert(!oidc.isUserLoggedIn);

            return oidc.login({ doesCurrentHrefRequiresAuth });
        },
    register:
        () =>
        (...args): Promise<never> => {
            const [, , { oidc }] = args;

            assert(!oidc.isUserLoggedIn);

            return oidc.login({
                doesCurrentHrefRequiresAuth: false,
                transformUrlBeforeRedirect: url => {
                    const urlObj = new URL(url);

                    urlObj.pathname = urlObj.pathname.replace(
                        /\/auth$/,
                        "/registrations"
                    );

                    return urlObj.href;
                }
            });
        },
    logout:
        (params: { redirectTo: "home" | "current page" }) =>
        (...args): Promise<never> => {
            const { redirectTo } = params;

            const [, , { oidc }] = args;

            assert(oidc.isUserLoggedIn);

            return oidc.logout({ redirectTo });
        }
} satisfies Thunks;
