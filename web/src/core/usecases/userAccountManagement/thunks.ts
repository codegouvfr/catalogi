// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { assert } from "tsafe/assert";
import type { Thunks } from "core/bootstrap";
import { addParamToUrl } from "powerhooks/tools/urlSearchParams";
import { name, actions } from "./state";

export const thunks = {
    initialize:
        () =>
        async (...args) => {
            const [dispatch, getState, { oidc, sillApi }] = args;

            {
                const state = getState()[name];

                if (state.stateDescription === "ready" || state.isInitializing) {
                    return;
                }
            }

            dispatch(actions.initializeStarted());

            assert(oidc.isUserLoggedIn);

            const currentUser = await sillApi.getCurrentUser();

            const [oidcParams, allOrganizations, { user }] = await Promise.all([
                sillApi.getOidcParams(),
                sillApi.getAllOrganizations(),
                sillApi.getUser({ email: currentUser.email })
            ]);

            const { about = "", isPublic, organization } = user;

            dispatch(
                actions.initialized({
                    email: currentUser.email,
                    organization: organization,
                    accountManagementUrl: addParamToUrl({
                        url: [oidcParams.issuerUri, "account"].join("/"),
                        name: "referrer",
                        value: oidcParams.clientId
                    }).newUrl,
                    allOrganizations,
                    about,
                    isPublic
                })
            );
        },
    updateField:
        (
            params:
                | {
                      fieldName: "organization";
                      value: string;
                  }
                | {
                      fieldName: "aboutAndIsPublic";
                      about: string;
                      isPublic: boolean;
                  }
        ) =>
        async (...args) => {
            const [dispatch, getState, { sillApi, oidc }] = args;

            const state = getState()[name];

            dispatch(actions.updateFieldStarted(params));

            assert(state.stateDescription === "ready");

            assert(oidc.isUserLoggedIn);

            switch (params.fieldName) {
                case "organization": {
                    await sillApi.updateUserProfile({
                        newOrganization: params.value
                    });
                    break;
                }
                case "aboutAndIsPublic": {
                    await sillApi.updateUserProfile({
                        about: params.about || undefined,
                        isPublic: params.isPublic
                    });
                    break;
                }
            }

            dispatch(actions.updateFieldCompleted(params));
        },
    getAccountManagementUrl:
        () =>
        (...args): string => {
            const [
                ,
                getState,
                {
                    paramsOfBootstrapCore: { getCurrentLang, getIsDark }
                }
            ] = args;

            const state = getState()[name];

            assert(state.stateDescription === "ready");

            assert(state.accountManagementUrl !== undefined);

            let url = state.accountManagementUrl;

            {
                const { newUrl } = addParamToUrl({
                    url,
                    name: "referrer_uri",
                    value: window.location.href
                });

                url = newUrl;
            }

            {
                const { newUrl } = addParamToUrl({
                    url,
                    name: "kc_locale",
                    value: getCurrentLang()
                });

                url = newUrl;
            }

            {
                const { newUrl } = addParamToUrl({
                    url,
                    name: "dark",
                    value: `${getIsDark()}`
                });

                url = newUrl;
            }

            return url;
        }
} satisfies Thunks;
