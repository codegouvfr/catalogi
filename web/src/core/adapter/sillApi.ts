import type { SillApi } from "../ports/SillApi";
import { createTRPCProxyClient, httpBatchLink, loggerLink } from "@trpc/client";
import type { TrpcRouter } from "api";
import superjson from "superjson";
import memoize from "memoizee";

export function createSillApi(params: {
    url: string;
    getOidcAccessToken: () => string | undefined;
}): SillApi {
    const { url, getOidcAccessToken } = params;

    const trpcClient = createTRPCProxyClient<TrpcRouter>({
        "transformer": superjson,
        "links": [
            loggerLink(),
            httpBatchLink({
                url,
                // You can pass any HTTP headers you wish here
                "headers": async () => {
                    const oidcAccessToken = getOidcAccessToken();

                    if (oidcAccessToken === undefined) {
                        return {};
                    }

                    return { "authorization": `Bearer ${oidcAccessToken}` };
                }
            })
        ]
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
        "getExternalSoftwareDataOrigin": memoize(
            () => trpcClient.getExternalSoftwareDataOrigin.query(),
            { "promise": true }
        ),
        "getRedirectUrl": params => trpcClient.getRedirectUrl.query(params),
        "getApiVersion": memoize(() => trpcClient.getApiVersion.query(), {
            "promise": true
        }),
        "getOidcParams": memoize(() => trpcClient.getOidcParams.query(), {
            "promise": true
        }),
        "getOrganizationUserProfileAttributeName": memoize(
            () => trpcClient.getOrganizationUserProfileAttributeName.query(),
            {
                "promise": true
            }
        ),
        "getSoftwares": memoize(() => trpcClient.getSoftwares.query(), {
            "promise": true
        }),
        "getInstances": memoize(() => trpcClient.getInstances.query(), {
            "promise": true
        }),
        "getExternalSoftwareOptions": params =>
            trpcClient.getExternalSoftwareOptions.query(params),
        "getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources": params =>
            trpcClient.getSoftwareFormAutoFillDataFromExternalSoftwareAndOtherSources.query(
                params
            ),
        "createSoftware": async params => {
            const out = await trpcClient.createSoftware
                .mutate(params)
                .catch(errorHandler);

            sillApi.getSoftwares.clear();

            return out;
        },
        "updateSoftware": async params => {
            const out = await trpcClient.updateSoftware
                .mutate(params)
                .catch(errorHandler);

            sillApi.getSoftwares.clear();

            return out;
        },
        "createUserOrReferent": async params => {
            const out = await trpcClient.createUserOrReferent
                .mutate(params)
                .catch(errorHandler);

            sillApi.getTotalReferentCount.clear();
            sillApi.getAgents.clear();
            sillApi.getSoftwares.clear();

            return out;
        },
        "removeUserOrReferent": async params => {
            const out = await trpcClient.removeUserOrReferent
                .mutate(params)
                .catch(errorHandler);

            sillApi.getTotalReferentCount.clear();
            sillApi.getAgents.clear();
            sillApi.getSoftwares.clear();

            return out;
        },
        "createInstance": async params => {
            const out = await trpcClient.createInstance
                .mutate(params)
                .catch(errorHandler);

            sillApi.getInstances.clear();

            return out;
        },
        "updateInstance": async params => {
            const out = await trpcClient.updateInstance
                .mutate(params)
                .catch(errorHandler);

            sillApi.getInstances.clear();

            return out;
        },
        "getAgents": memoize(() => trpcClient.getAgents.query(), { "promise": true }),
        "updateEmail": async params => {
            const out = await trpcClient.updateEmail.mutate(params).catch(errorHandler);

            sillApi.getAgents.clear();

            return out;
        },
        "getAllowedEmailRegexp": memoize(() => trpcClient.getAllowedEmailRegexp.query(), {
            "promise": true
        }),
        "getAllOrganizations": memoize(() => trpcClient.getAllOrganizations.query(), {
            "promise": true
        }),
        "getTotalReferentCount": memoize(() => trpcClient.getTotalReferentCount.query(), {
            "promise": true
        }),
        "getRegisteredUserCount": memoize(
            () => trpcClient.getRegisteredUserCount.query(),
            { "promise": true }
        ),
        "getTermsOfServiceUrl": memoize(() => trpcClient.getTermsOfServiceUrl.query(), {
            "promise": true
        }),
        "getMarkdown": params => trpcClient.getMarkdown.query(params),
        "getAgent": params => trpcClient.getAgent.query(params),
        "getIsAgentProfilePublic": params =>
            trpcClient.getIsAgentProfilePublic.query(params),
        "updateAgentProfile": async params => {
            await trpcClient.updateAgentProfile.mutate(params).catch(errorHandler);
            sillApi.getAgents.clear();
        },
        "unreferenceSoftware": async params => {
            await trpcClient.unreferenceSoftware.mutate(params).catch(errorHandler);

            sillApi.getSoftwares.clear();
        }
    };

    return sillApi;
}
