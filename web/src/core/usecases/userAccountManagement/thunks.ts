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
            const [dispatch, getState, { sillApi }] = args;

            {
                const state = getState()[name];

                if (state.stateDescription === "ready" || state.isInitializing) {
                    return;
                }
            }

            dispatch(actions.initializeStarted());

            const state = getState();
            const { currentUser } = state.userAuthentication;

            if (!currentUser) throw new Error("User not found, you need to be logged in");

            const [oidcManageProfileUrl, allOrganizations] = await Promise.all([
                sillApi.getOidcManageProfileUrl(),
                sillApi.getAllOrganizations()
            ]);

            const { about = "", isPublic, organization } = currentUser;

            dispatch(
                actions.initialized({
                    email: currentUser.email,
                    organization: organization,
                    accountManagementUrl: oidcManageProfileUrl,
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
            const [dispatch, getState, { sillApi }] = args;

            const state = getState()[name];

            dispatch(actions.updateFieldStarted(params));

            assert(state.stateDescription === "ready");

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
