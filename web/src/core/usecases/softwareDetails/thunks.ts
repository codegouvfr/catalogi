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
import { apiSoftwareToExternalCatalogSoftware } from "core/usecases/softwareCatalog";
import { name, actions, type State } from "./state";

export const thunks = {
    initialize:
        (params: { softwareName: string }) =>
        async (...args) => {
            const { softwareName } = params;

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

                        dispatch(thunks.initialize({ softwareName }));
                    }
                );

                context.detachHandlers = () => ctx.done();
            }

            dispatch(actions.initializationStarted());

            const [mainSource, apiSoftwares, apiInstances] = await Promise.all([
                sillApi.getMainSource(),
                sillApi.getSoftwares(),
                sillApi.getInstances()
            ]);

            let software: State.Software;

            try {
                software = apiSoftwareToSoftware({
                    apiSoftwares,
                    apiInstances,
                    softwareName,
                    mainSource
                });
            } catch (error) {
                dispatch(actions.initializationFailed({ error: error as Error }));
                return;
            }

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
                                    d.softwareName === softwareName &&
                                    d.declarationType === "referent"
                            ) !== undefined,
                        isUser:
                            user.declarations.find(
                                d =>
                                    d.softwareName === softwareName &&
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
    apiSoftwares: ApiTypes.Software[];
    apiInstances: ApiTypes.Instance[];
    softwareName: string;
    mainSource: ApiTypes.Source;
}): State.Software {
    const { apiSoftwares, apiInstances, softwareName } = params;

    const apiSoftware = apiSoftwares.find(
        apiSoftware => apiSoftware.softwareName === softwareName
    );

    if (!apiSoftware) {
        throw new Error(`Software "${softwareName}" not found`);
    }

    const {
        softwareId,
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
        sourceSlug,
        externalId,
        license,
        versionMin,
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
            const software = apiSoftwareToExternalCatalogSoftware({
                apiSoftwares,
                softwareRef: similarSoftware.registered
                    ? {
                          type: "name",
                          softwareName: similarSoftware.softwareName
                      }
                    : {
                          type: "externalId",
                          externalId: similarSoftware.externalId,
                          sourceSlug: similarSoftware.sourceSlug
                      }
            });

            if (software === undefined) {
                assert(!similarSoftware.registered);

                return {
                    registered: false,
                    sourceSlug: similarSoftware.sourceSlug,
                    externalId: similarSoftware.externalId,
                    label: similarSoftware.label,
                    description: similarSoftware.description,
                    isLibreSoftware: similarSoftware.isLibreSoftware
                } satisfies State.SimilarSoftwareNotRegistered;
            }

            return {
                registered: true,
                software
            };
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
        versionMin,
        programmingLanguages,
        keywords,
        applicationCategories,
        referencePublications,
        softwareType,
        identifiers: identifiers ?? []
    };
}
