// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { assert } from "tsafe/assert";
import { name, actions, type State, type FormData } from "./state";

export const thunks = {
    initialize:
        (params: { softwareName: string }) =>
        async (...args) => {
            const { softwareName } = params;

            const [dispatch, getState, { sillApi }] = args;

            {
                const state = getState()[name];

                assert(
                    state.stateDescription === "not ready",
                    "The clear function should have been called"
                );

                if (state.isInitializing) {
                    return;
                }
            }

            dispatch(actions.initializationStarted());

            const software = (await sillApi.getSoftwares()).find(
                software => software.softwareName === softwareName
            );

            assert(software !== undefined);

            dispatch(
                actions.initializationCompleted({
                    software: {
                        logoUrl: software.logoUrl,
                        softwareName,
                        softwareId: software.softwareId,
                        referentCount: Object.values(
                            software.userAndReferentCountByOrganization
                        )
                            .map(({ referentCount }) => referentCount)
                            .reduce((prev, curr) => prev + curr, 0),
                        userCount: Object.values(
                            software.userAndReferentCountByOrganization
                        )
                            .map(({ userCount }) => userCount)
                            .reduce((prev, curr) => prev + curr, 0),
                        softwareType: (() => {
                            switch (software.softwareType.type) {
                                case "cloud":
                                    return "cloud";
                                case "desktop/mobile":
                                    return "desktop/mobile";
                                case "stack":
                                    return "other";
                            }
                        })()
                    }
                })
            );
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
    setDeclarationType:
        (props: { declarationType: State.Ready["declarationType"] }) =>
        async (...args) => {
            const { declarationType } = props;

            const [dispatch, getState, { sillApi }] = args;

            const state = getState();
            const { currentUser } = state.userAuthentication;

            redirect_if_declaration_already_exists: {
                if (!currentUser) {
                    break redirect_if_declaration_already_exists;
                }

                const { softwareName } = (() => {
                    const state = getState()[name];

                    assert(state.stateDescription === "ready");

                    const { softwareName } = state.software;

                    return { softwareName };
                })();

                if (
                    currentUser.declarations.find(
                        declaration =>
                            declaration.declarationType === declarationType &&
                            declaration.softwareName === softwareName
                    ) === undefined
                ) {
                    break redirect_if_declaration_already_exists;
                }

                dispatch(actions.triggerRedirect({ isFormSubmitted: false }));
            }

            dispatch(actions.declarationTypeSet({ declarationType }));
        },
    navigateToPreviousStep:
        () =>
        (...args) => {
            const [dispatch] = args;

            dispatch(actions.navigatedToPreviousStep());
        },
    submit:
        (props: { formData: FormData }) =>
        async (...args) => {
            const { formData } = props;

            const [dispatch, getState, { sillApi }] = args;

            const state = getState()[name];

            assert(state.stateDescription === "ready");

            assert(formData.declarationType === state.declarationType);

            dispatch(actions.submissionStarted());

            await sillApi.createUserOrReferent({
                formData,
                softwareId: state.software.softwareId
            });

            dispatch(actions.triggerRedirect({ isFormSubmitted: true }));
        }
} satisfies Thunks;
