// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { SillApi } from "../ports/SillApi";
import { createTRPCProxyClient, httpBatchLink, loggerLink } from "@trpc/client";
import type { TrpcRouter } from "api";
import superjson from "superjson";
import memoize from "memoizee";

export function createSillApi(params: { url: string }): SillApi {
    const { url } = params;

    const trpcClient = createTRPCProxyClient<TrpcRouter>({
        transformer: superjson,
        links: [loggerLink(), httpBatchLink({ url })]
    });

    const errorHandler = (err: any) => {
        if (err.shape?.message) {
            alert(err.shape.message);
        } else {
            alert("An unknown error occurred");
        }
        throw err;
    };

    const sillApi: SillApi = {
        getMainSource: memoize(() => trpcClient.getMainSource.query(), {
            promise: true
        }),
        getCurrentUser: memoize(() => trpcClient.getCurrentUser.query(), {
            promise: true
        }),
        getExternalSoftwareDataOrigin: memoize(
            () => trpcClient.getExternalSoftwareDataOrigin.query(),
            { promise: true }
        ),
        getRedirectUrl: params => trpcClient.getRedirectUrl.query(params),
        getUiConfig: memoize(() => trpcClient.getUiConfig.query(), {
            promise: true
        }),
        getApiVersion: memoize(() => trpcClient.getApiVersion.query(), {
            promise: true
        }),
        getOidcManageProfileUrl: memoize(
            () => trpcClient.getOidcManageProfileUrl.query(),
            {
                promise: true
            }
        ),
        getSoftwares: memoize(() => trpcClient.getSoftwares.query(), {
            promise: true
        }),
        getInstances: memoize(() => trpcClient.getInstances.query(), {
            promise: true
        }),
        getExternalSoftwareOptions: params =>
            trpcClient.getExternalSoftwareOptions.query(params),
        getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources: params =>
            trpcClient.getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources.query(
                params
            ),
        createSoftware: async params => {
            const out = await trpcClient.createSoftware
                .mutate(params)
                .catch(errorHandler);

            sillApi.getSoftwares.clear();

            return out;
        },
        updateSoftware: async params => {
            const out = await trpcClient.updateSoftware
                .mutate(params)
                .catch(errorHandler);

            sillApi.getSoftwares.clear();

            return out;
        },
        createUserOrReferent: async params => {
            const out = await trpcClient.createUserOrReferent
                .mutate(params)
                .catch(errorHandler);

            sillApi.getTotalReferentCount.clear();
            sillApi.getUsers.clear();
            sillApi.getSoftwares.clear();

            return out;
        },
        removeUserOrReferent: async params => {
            const out = await trpcClient.removeUserOrReferent
                .mutate(params)
                .catch(errorHandler);

            sillApi.getTotalReferentCount.clear();
            sillApi.getUsers.clear();
            sillApi.getSoftwares.clear();

            return out;
        },
        createInstance: async params => {
            const out = await trpcClient.createInstance
                .mutate(params)
                .catch(errorHandler);

            sillApi.getInstances.clear();

            return out;
        },
        updateInstance: async params => {
            const out = await trpcClient.updateInstance
                .mutate(params)
                .catch(errorHandler);

            sillApi.getInstances.clear();

            return out;
        },
        getUsers: memoize(() => trpcClient.getUsers.query(), { promise: true }),
        updateEmail: async params => {
            const out = await trpcClient.updateEmail.mutate(params).catch(errorHandler);

            sillApi.getUsers.clear();

            return out;
        },
        getAllOrganizations: memoize(() => trpcClient.getAllOrganizations.query(), {
            promise: true
        }),
        getTotalReferentCount: memoize(() => trpcClient.getTotalReferentCount.query(), {
            promise: true
        }),
        getRegisteredUserCount: memoize(() => trpcClient.getRegisteredUserCount.query(), {
            promise: true
        }),
        getUser: params => trpcClient.getUser.query(params),
        getIsUserProfilePublic: params => trpcClient.getIsUserProfilePublic.query(params),
        updateUserProfile: async params => {
            await trpcClient.updateUserProfile.mutate(params).catch(errorHandler);
            sillApi.getUsers.clear();
        },
        unreferenceSoftware: async params => {
            await trpcClient.unreferenceSoftware.mutate(params).catch(errorHandler);

            sillApi.getSoftwares.clear();
        }
    };

    return sillApi;
}
