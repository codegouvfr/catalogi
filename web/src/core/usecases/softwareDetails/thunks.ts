// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { id } from "tsafe/id";
import { assert } from "tsafe/assert";
import type { ApiTypes } from "api";
import { createUsecaseContextApi } from "redux-clean-architecture";
import { Evt } from "evt";
import { softwareInListToExternalCatalogSoftware } from "core/usecases/softwareCatalog";
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
                                    d.softwareName === apiSoftware.softwareName &&
                                    d.declarationType === "referent"
                            ) !== undefined,
                        isUser:
                            user.declarations.find(
                                d =>
                                    d.softwareName === apiSoftware.softwareName &&
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

            const time = Date.now();

            await sillApi.unreferenceSoftware({
                softwareId: state.software.softwareId,
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

    const {
        softwareId,
        softwareName,
        logoUrl,
        authors,
        officialWebsiteUrl,
        documentationUrl,
        codeRepositoryUrl,
        softwareDescription,
        latestVersion,
        addedTime,
        dereferencing,
        customAttributes,
        similarSoftwares: similarSoftwares_api,
        license,
        softwareType,
        userAndReferentCountByOrganization,
        serviceProviders,
        programmingLanguages,
        keywords,
        referencePublications,
        applicationCategories,
        identifiers
    } = apiSoftware;

    return {
        softwareId,
        logoUrl,
        authors,
        officialWebsiteUrl,
        documentationUrl,
        codeRepositoryUrl,
        softwareName,
        softwareDescription,
        latestVersion: {
            semVer: latestVersion?.semVer ?? "",
            publicationTime: latestVersion?.publicationTime
        },
        dereferencing,
        serviceProviders: serviceProviders ?? [],
        referentCount: Object.values(userAndReferentCountByOrganization)
            .map(({ referentCount }) => referentCount)
            .reduce((prev, curr) => prev + curr, 0),
        userCount: Object.values(userAndReferentCountByOrganization)
            .map(({ userCount }) => userCount)
            .reduce((prev, curr) => prev + curr, 0),
        addedTime,
        instances:
            softwareType.type !== "cloud"
                ? undefined
                : apiInstances
                      .filter(instance => instance.mainSoftwareSillId === softwareId)
                      .map(instance => ({
                          id: instance.id,
                          instanceUrl: instance.instanceUrl,
                          organization: instance.organization,
                          targetAudience: instance.targetAudience,
                          isPublic: instance.isPublic
                      })),
        similarSoftwares: similarSoftwares_api.map(similarSoftware => {
            if (similarSoftware.registered) {
                const externalSoftware = softwareInListToExternalCatalogSoftware({
                    softwareList,
                    softwareName: similarSoftware.softwareName
                });

                if (externalSoftware !== undefined) {
                    return {
                        registered: true,
                        software: externalSoftware
                    };
                }
            }

            return {
                registered: false,
                sourceSlug: similarSoftware.sourceSlug,
                externalId: similarSoftware.externalId,
                label: similarSoftware.label,
                description: similarSoftware.description,
                isLibreSoftware: similarSoftware.isLibreSoftware
            } satisfies State.SimilarSoftwareNotRegistered;
        }),
        license,
        customAttributes,
        supportedPlatforms: {
            isInstallableOnUserComputer:
                softwareType.type === "stack"
                    ? undefined
                    : softwareType.type === "desktop/mobile",
            isAvailableAsMobileApp:
                softwareType.type === "desktop/mobile" &&
                (softwareType.os.android || softwareType.os.ios)
        },
        programmingLanguages,
        keywords,
        applicationCategories,
        referencePublications,
        softwareType,
        identifiers: identifiers ?? []
    };
}
