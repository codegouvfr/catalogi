// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { assert } from "tsafe/assert";
import type { ApiTypes } from "api";
import { name, actions } from "./state";

export const thunks = {
    initialize:
        (
            params:
                | {
                      type: "update";
                      instanceId: number;
                  }
                | {
                      type: "create";
                      softwareName: string | undefined;
                  }
        ) =>
        async (...args) => {
            const [dispatch, getState, { sillApi }] = args;

            const state = getState();
            const { currentUser } = state.userAuthentication;

            {
                const instanceFormState = state[name];

                assert(
                    instanceFormState.stateDescription === "not ready",
                    "The clear function should have been called"
                );

                if (instanceFormState.isInitializing) {
                    return;
                }
            }

            dispatch(actions.initializationStarted());

            const softwares = await sillApi.getSoftwares();

            const allSillSoftwares = softwares.map(
                ({ softwareName, softwareId, softwareDescription }) => ({
                    softwareDescription,
                    softwareSillId: softwareId,
                    softwareName
                })
            );

            switch (params.type) {
                case "update":
                    const instance = (await sillApi.getInstances()).find(
                        instance => instance.id === params.instanceId
                    );

                    assert(instance !== undefined);

                    dispatch(
                        actions.initializationCompleted({
                            allSillSoftwares,
                            preFillData: {
                                type: "update",
                                instanceId: instance.id,
                                mainSoftwareSillId: instance.mainSoftwareSillId,
                                organization: instance.organization,
                                instanceUrl: instance.instanceUrl,
                                isPublic: instance.isPublic,
                                targetAudience: instance.targetAudience
                            }
                        })
                    );

                    break;
                case "create":
                    const software =
                        params.softwareName === undefined
                            ? undefined
                            : softwares.find(
                                  software =>
                                      software.softwareName === params.softwareName
                              );

                    assert(currentUser);

                    const { user } = await sillApi.getUser({ email: currentUser.email });

                    dispatch(
                        actions.initializationCompleted({
                            allSillSoftwares,
                            preFillData:
                                software === undefined
                                    ? undefined
                                    : {
                                          type: "navigated from software form",
                                          justRegisteredSoftwareSillId:
                                              software.softwareId,
                                          userOrganization: user.organization
                                      }
                        })
                    );

                    break;
            }
        },
    clear:
        () =>
        (...args) => {
            const [dispatch, getState] = args;

            {
                const state = getState()[name];

                if (state.stateDescription === "not ready") {
                    return;
                }
            }

            dispatch(actions.cleared());
        },
    completeStep1:
        (props: { mainSoftwareSillId: number }) =>
        (...args) => {
            const { mainSoftwareSillId } = props;

            const [dispatch] = args;

            dispatch(
                actions.step1Completed({
                    step1Data: { mainSoftwareSillId }
                })
            );
        },
    submit:
        (props: {
            targetAudience: string;
            organization: string;
            instanceUrl: string | undefined;
            isPublic: boolean;
        }) =>
        async (...args) => {
            const { targetAudience, instanceUrl, organization, isPublic } = props;

            const [dispatch, getState, { sillApi }] = args;

            const state = getState()[name];

            assert(state.stateDescription === "ready");

            const { step1Data } = state;

            assert(step1Data !== undefined);

            const formData: ApiTypes.InstanceFormData = {
                mainSoftwareSillId: step1Data.mainSoftwareSillId,
                organization,
                instanceUrl,
                targetAudience,
                isPublic
            };

            let instanceId =
                state.preFillData?.type !== "update"
                    ? undefined
                    : state.preFillData.instanceId;

            dispatch(actions.submissionStarted());

            if (instanceId !== undefined) {
                await sillApi.updateInstance({
                    formData,
                    instanceId
                });
            } else {
                instanceId = (
                    await sillApi.createInstance({
                        formData
                    })
                ).instanceId;
            }

            const software = (await sillApi.getSoftwares()).find(
                software => software.softwareId === formData.mainSoftwareSillId
            );

            assert(software !== undefined);

            dispatch(actions.formSubmitted({ softwareName: software.softwareName }));
        },
    returnToPreviousStep:
        () =>
        (...args) => {
            const [dispatch] = args;

            dispatch(actions.navigatedToPreviousStep());
        }
} satisfies Thunks;
