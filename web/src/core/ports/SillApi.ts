// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { assert, type Equals } from "tsafe/assert";
import type { TrpcRouterInput, TrpcRouterOutput } from "api";

export type SillApi = {
    getCurrentUser: {
        (
            params: TrpcRouterInput["getCurrentUser"]
        ): Promise<TrpcRouterOutput["getCurrentUser"]>;
        clear: () => void;
    };
    getMainSource: {
        (
            params: TrpcRouterInput["getMainSource"]
        ): Promise<TrpcRouterOutput["getMainSource"]>;
        clear: () => void;
    };
    getExternalSoftwareDataOrigin: {
        (
            params: TrpcRouterInput["getExternalSoftwareDataOrigin"]
        ): Promise<TrpcRouterOutput["getExternalSoftwareDataOrigin"]>;
        clear: () => void;
    };
    getRedirectUrl: (
        params: TrpcRouterInput["getRedirectUrl"]
    ) => Promise<TrpcRouterOutput["getRedirectUrl"]>;
    getUiConfig: {
        (
            params: TrpcRouterInput["getUiConfig"]
        ): Promise<TrpcRouterOutput["getUiConfig"]>;
        clear: () => void;
    };
    getApiVersion: {
        (
            params: TrpcRouterInput["getApiVersion"]
        ): Promise<TrpcRouterOutput["getApiVersion"]>;
        clear: () => void;
    };
    getOidcParams: {
        (
            params: TrpcRouterInput["getOidcParams"]
        ): Promise<TrpcRouterOutput["getOidcParams"]>;
        clear: () => void;
    };
    getSoftwares: {
        (
            params: TrpcRouterInput["getSoftwares"]
        ): Promise<TrpcRouterOutput["getSoftwares"]>;
        clear: () => void;
    };
    getInstances: {
        (): Promise<TrpcRouterOutput["getInstances"]>;
        clear: () => void;
    };
    getExternalSoftwareOptions: (
        params: TrpcRouterInput["getExternalSoftwareOptions"]
    ) => Promise<TrpcRouterOutput["getExternalSoftwareOptions"]>;
    getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources: (
        params: TrpcRouterInput["getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources"]
    ) => Promise<
        TrpcRouterOutput["getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources"]
    >;
    createSoftware: (
        params: TrpcRouterInput["createSoftware"]
    ) => Promise<TrpcRouterOutput["createSoftware"]>;
    updateSoftware: (
        params: TrpcRouterInput["updateSoftware"]
    ) => Promise<TrpcRouterOutput["updateSoftware"]>;
    createUserOrReferent: (
        params: TrpcRouterInput["createUserOrReferent"]
    ) => Promise<TrpcRouterOutput["createUserOrReferent"]>;
    removeUserOrReferent: (
        params: TrpcRouterInput["removeUserOrReferent"]
    ) => Promise<TrpcRouterOutput["removeUserOrReferent"]>;
    createInstance: (
        params: TrpcRouterInput["createInstance"]
    ) => Promise<TrpcRouterOutput["createInstance"]>;
    updateInstance: (
        params: TrpcRouterInput["updateInstance"]
    ) => Promise<TrpcRouterOutput["updateInstance"]>;
    getUsers: {
        (params: TrpcRouterInput["getUsers"]): Promise<TrpcRouterOutput["getUsers"]>;
        clear: () => void;
    };
    updateEmail: (
        params: TrpcRouterInput["updateEmail"]
    ) => Promise<TrpcRouterOutput["updateEmail"]>;

    getAllOrganizations: {
        (
            params: TrpcRouterInput["getAllOrganizations"]
        ): Promise<TrpcRouterOutput["getAllOrganizations"]>;
        clear: () => void;
    };
    getTotalReferentCount: {
        (
            params: TrpcRouterInput["getTotalReferentCount"]
        ): Promise<TrpcRouterOutput["getTotalReferentCount"]>;
        clear: () => void;
    };
    getRegisteredUserCount: {
        (
            params: TrpcRouterInput["getRegisteredUserCount"]
        ): Promise<TrpcRouterOutput["getRegisteredUserCount"]>;
        clear: () => void;
    };
    getIsUserProfilePublic: (
        params: TrpcRouterInput["getIsUserProfilePublic"]
    ) => Promise<TrpcRouterOutput["getIsUserProfilePublic"]>;
    getUser: (params: TrpcRouterInput["getUser"]) => Promise<TrpcRouterOutput["getUser"]>;
    updateUserProfile: (
        params: TrpcRouterInput["updateUserProfile"]
    ) => Promise<TrpcRouterOutput["updateUserProfile"]>;
    unreferenceSoftware: (
        params: TrpcRouterInput["unreferenceSoftware"]
    ) => Promise<TrpcRouterOutput["unreferenceSoftware"]>;
};

//NOTE: We make sure we don't forget queries
{
    type X = Exclude<keyof SillApi, keyof TrpcRouterInput>;
    type Y = Exclude<keyof TrpcRouterInput, keyof SillApi>;

    assert<Equals<X, never>>();
    assert<Equals<Y, never>>();
}
