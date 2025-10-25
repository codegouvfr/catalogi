// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { usecases } from "./usecases";
import type { LocalizedString } from "i18nifty";
import type { Language } from "api";
import { createCore, type GenericCore } from "redux-clean-architecture";
import { createSillApi } from "core/adapter/sillApi";
import { SillApi } from "./ports/SillApi";

type ParamsOfBootstrapCore = {
    /** Empty string for using mock */
    apiUrl: string;
    appUrl: string;
    getCurrentLang: () => Language;
    getIsDark: () => boolean;
    onMoved: (params: { redirectUrl: string }) => void;
};

type Context = {
    paramsOfBootstrapCore: ParamsOfBootstrapCore;
    sillApi: SillApi;
};

type Core = GenericCore<typeof usecases, Context>;

export type State = Core["types"]["State"];
export type Thunks = Core["types"]["Thunks"];
export type CreateEvt = Core["types"]["CreateEvt"];

export async function bootstrapCore(
    params: ParamsOfBootstrapCore
): Promise<{ core: Core }> {
    const { apiUrl } = params;

    const sillApi = createSillApi({
        url: apiUrl
    });

    const redirectUrl = await sillApi.getRedirectUrl();

    if (redirectUrl !== undefined) {
        params.onMoved({ redirectUrl });

        await new Promise(() => {});
    }

    const context: Context = {
        paramsOfBootstrapCore: params,
        sillApi
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
        dispatch(usecases.userAuthentication.thunks.getCurrentUser())
    ]);

    return { core };
}
