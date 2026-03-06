// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { id } from "tsafe/id";
import { assert } from "tsafe/assert";
import type { ApiTypes } from "api";
import { createUsecaseContextApi } from "redux-clean-architecture";
import { Evt } from "evt";
import { createResolveLocalizedString } from "i18nifty";
import { name, actions, type State } from "./state";

export const thunks = {
    initialize:
        (params: { softwareId: number }) =>
        async (...args) => {
            const { softwareId } = params;

            const [dispatch, getState, extraArg] = args;

            const state = getState();
            const { currentUser } = state.userAuthentication;
            {
                const softwareDetailsState = state[name];
                assert(
                    softwareDetailsState.stateDescription === "not ready",
                    "The clear function should have been called"
                );

                if (softwareDetailsState.isInitializing) {
                    return;
                }
            }

            const { sillApi, evtAction } = extraArg;

            {
                const context = getContext(extraArg);

                const ctx = Evt.newCtx();

                evtAction.attach(
                    action =>
                        action.usecaseName === "declarationRemoval" &&
                        action.actionName === "userOrReferentRemoved",
                    ctx,
                    () => {
                        dispatch(thunks.clear());

                        dispatch(thunks.initialize({ softwareId }));
                    }
                );

                context.detachHandlers = () => ctx.done();
            }

            dispatch(actions.initializationStarted());

            const [apiSoftware, apiInstances, softwareList] = await Promise.all([
                sillApi.getSoftwareDetails({ softwareId }),
                sillApi.getInstances(),
                sillApi.getSoftwareList()
            ]);

            if (!apiSoftware) {
                dispatch(
                    actions.initializationFailed({
                        error: new Error(`Software with id ${softwareId} not found`)
                    })
                );
                return;
            }

            const software = apiSoftwareToSoftware({
                apiSoftware,
                apiInstances,
                softwareList
            });

            const userDeclaration: { isReferent: boolean; isUser: boolean } | undefined =
                await (async () => {
                    if (!currentUser) return;

                    const { users } = await sillApi.getUsers();

                    const user = users.find(user => user.email === currentUser.email);

                    if (user === undefined) {
                        return {
                            isReferent: false,
                            isUser: false
                        };
                    }

                    return {
                        isReferent:
                            user.declarations.find(
                                d =>
                                    d.softwareName === apiSoftware.name &&
                                    d.declarationType === "referent"
                            ) !== undefined,
                        isUser:
                            user.declarations.find(
                                d =>
                                    d.softwareName === apiSoftware.name &&
                                    d.declarationType === "user"
                            ) !== undefined
                    };
                })();

            dispatch(actions.initializationCompleted({ software, userDeclaration }));
        },
    clear:
        () =>
        (...args) => {
            const [dispatch, getState, extraArg] = args;

            {
                const state = getState()[name];

                if (state.stateDescription === "not ready") {
                    return;
                }
            }

            {
                const context = getContext(extraArg);

                assert(context.detachHandlers !== undefined);

                context.detachHandlers();

                context.detachHandlers = undefined;
            }

            dispatch(actions.cleared());
        },
    unreference:
        (params: { reason: string }) =>
        async (...args) => {
            const { reason } = params;

            const [dispatch, getState, { sillApi }] = args;

            const state = getState()[name];

            assert(state.stateDescription === "ready");

            dispatch(actions.unreferencingStarted());

            const time = new Date().toISOString();

            await sillApi.unreferenceSoftware({
                softwareId: state.software.id,
                reason
            });

            dispatch(actions.unreferencingCompleted({ reason, time }));
        }
} satisfies Thunks;

const { getContext } = createUsecaseContextApi(() => ({
    detachHandlers: id<undefined | (() => void)>(undefined)
}));

function apiSoftwareToSoftware(params: {
    apiSoftware: ApiTypes.Software;
    apiInstances: ApiTypes.Instance[];
    softwareList: ApiTypes.SoftwareInList[];
}): State.Software {
    const { apiSoftware, apiInstances, softwareList } = params;

    const { resolveLocalizedString } = createResolveLocalizedString({
        currentLanguage: "fr",
        fallbackLanguage: "en"
    });

    const {
        id,
        image,
        authors,
        url,
        softwareHelp,
        codeRepositoryUrl,
        latestVersion,
        addedTime,
        dereferencing,
        customAttributes,
        similarSoftwares: similarSoftwares_api,
        license,
        operatingSystems,
        runtimePlatforms,
        userAndReferentCountByOrganization,
        providers,
        programmingLanguages,
        keywords,
        referencePublications,
        applicationCategories,
        identifiers,
        repoMetadata
    } = apiSoftware;

    return {
        id,
        image,
        authors,
        url,
        softwareHelp,
        codeRepositoryUrl,
        name: resolveLocalizedString(apiSoftware.name),
        description: resolveLocalizedString(apiSoftware.description),
        latestVersion: latestVersion
            ? {
                  version: latestVersion.version ?? "",
                  releaseDate: latestVersion.releaseDate
              }
            : undefined,
        dereferencing,
        providers: providers ?? [],
        referentCount: Object.values(userAndReferentCountByOrganization)
            .map(({ referentCount }) => referentCount)
            .reduce((prev, curr) => prev + curr, 0),
        userCount: Object.values(userAndReferentCountByOrganization)
            .map(({ userCount }) => userCount)
            .reduce((prev, curr) => prev + curr, 0),
        addedTime,
        instances: !runtimePlatforms.includes("cloud")
            ? undefined
            : apiInstances
                  .filter(instance => instance.mainSoftwareSillId === id)
                  .map(instance => ({
                      id: instance.id,
                      instanceUrl: instance.instanceUrl,
                      organization: instance.organization,
                      targetAudience: instance.targetAudience,
                      isPublic: instance.isPublic
                  })),
        similarSoftwares: similarSoftwares_api.map(similarSoftware => {
            if (
                similarSoftware.isInCatalogi &&
                similarSoftware.softwareId !== undefined
            ) {
                const catalogSoftware = softwareList.find(
                    s => s.id === similarSoftware.softwareId
                );
                if (catalogSoftware !== undefined) {
                    return {
                        isInCatalogi: true as const,
                        software: {
                            ...catalogSoftware,
                            name: resolveLocalizedString(catalogSoftware.name),
                            description: resolveLocalizedString(
                                catalogSoftware.description
                            )
                        }
                    };
                }
            }

            return {
                isInCatalogi: false as const,
                sourceSlug: similarSoftware.sourceSlug,
                externalId: similarSoftware.externalId,
                name: similarSoftware.name,
                description: similarSoftware.description,
                isLibreSoftware: similarSoftware.isLibreSoftware
            };
        }),
        license,
        customAttributes,
        supportedPlatforms: {
            isInstallableOnUserComputer:
                runtimePlatforms.length === 0
                    ? undefined
                    : runtimePlatforms.includes("desktop"),
            isAvailableAsMobileApp:
                runtimePlatforms.includes("mobile") ||
                (runtimePlatforms.includes("desktop") &&
                    (operatingSystems.android === true || operatingSystems.ios === true))
        },
        programmingLanguages,
        keywords,
        applicationCategories,
        referencePublications,
        operatingSystems,
        runtimePlatforms,
        identifiers: identifiers ?? [],
        repoMetadata
    };
}
