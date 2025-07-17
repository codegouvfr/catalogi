// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { usecases } from "./usecases";
import type { LocalizedString } from "i18nifty";
import type { Language } from "shared";
import type { Oidc } from "./ports/Oidc";
import { createCore, type GenericCore } from "redux-clean-architecture";
import { createSillApi } from "core/adapter/sillApi";
import { SillApi } from "./ports/SillApi";

type ParamsOfBootstrapCore = {
    /** Empty string for using mock */
    apiUrl: string;
    appUrl: string;
    transformUrlBeforeRedirectToLogin: (params: { url: string }) => string;
    getCurrentLang: () => Language;
    getIsDark: () => boolean;
    onMoved: (params: { redirectUrl: string }) => void;
};

type Context = {
    paramsOfBootstrapCore: ParamsOfBootstrapCore;
    sillApi: SillApi;
    oidc: Oidc;
};

type Core = GenericCore<typeof usecases, Context>;

export type State = Core["types"]["State"];
export type Thunks = Core["types"]["Thunks"];
export type CreateEvt = Core["types"]["CreateEvt"];

export async function bootstrapCore(
    params: ParamsOfBootstrapCore
): Promise<{ core: Core }> {
    const { apiUrl, appUrl, transformUrlBeforeRedirectToLogin, getCurrentLang } = params;

    let oidc: Oidc | undefined = undefined;

    const sillApi = createSillApi({
        url: apiUrl,
        getOidcAccessToken: () => {
            if (oidc === undefined || !oidc.isUserLoggedIn) {
                return undefined;
            }
            return oidc.getTokens().accessToken;
        }
    });

    const redirectUrl = await sillApi.getRedirectUrl();

    if (redirectUrl !== undefined) {
        params.onMoved({ redirectUrl });

        await new Promise(() => {});
    }

    const oidcParams = await sillApi.getOidcParams();

    oidc = await (async () => {
        const { createOidc } = await import("core/adapter/oidc");

        return createOidc({
            issuerUri: oidcParams.issuerUri,
            clientId: oidcParams.clientId,
            appUrl,
            transformUrlBeforeRedirect: url =>
                transformUrlBeforeRedirectToLogin({
                    url
                }),
            getUiLocales: getCurrentLang
        });
    })();

    const context: Context = {
        paramsOfBootstrapCore: params,
        sillApi,
        oidc
    };

    const { core, dispatch } = createCore({
        usecases,
        context
    });

    await Promise.all([
        dispatch(usecases.uiConfig.protectedThunks.initialize()),
        dispatch(usecases.sillApiVersion.protectedThunks.initialize()),
        dispatch(usecases.externalDataOrigin.protectedThunks.initialize()),
        dispatch(usecases.source.protectedThunks.initialize()),
        dispatch(usecases.softwareCatalog.protectedThunks.initialize()),
        dispatch(usecases.generalStats.protectedThunks.initialize()),
        dispatch(usecases.redirect.protectedThunks.initialize()),
        dispatch(usecases.userAuthentication.protectedThunks.initialize())
    ]);

    return { core };
}
