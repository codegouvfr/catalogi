// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { removeDuplicates } from "evt/tools/reducers/removeDuplicates";
import { actions } from "./state";

export const thunks = {};

export const protectedThunks = {
    initialize:
        () =>
        async (...args) => {
            const [dispatch, , { sillApi, evtAction }] = args;

            const init = async () => {
                const [{ referentCount }, softwares, registeredUserCount] =
                    await Promise.all([
                        sillApi.getTotalReferentCount(),
                        sillApi.getSoftwareList(),
                        sillApi.getRegisteredUserCount()
                    ]);

                dispatch(
                    actions.update({
                        state: {
                            agentReferentCount: referentCount,
                            organizationCount: softwares
                                .map(software =>
                                    Object.keys(
                                        software.userAndReferentCountByOrganization
                                    )
                                )
                                .flat()
                                .reduce(...removeDuplicates()).length,
                            registeredUserCount,
                            softwareCount: softwares.length
                        }
                    })
                );
            };

            evtAction.attach(
                action =>
                    (action.usecaseName === "softwareForm" &&
                        action.actionName === "formSubmitted") ||
                    (action.usecaseName === "declarationForm" &&
                        action.actionName === "triggerRedirect" &&
                        action.payload.isFormSubmitted) ||
                    (action.usecaseName === "declarationRemoval" &&
                        action.actionName === "userOrReferentRemoved"),
                () => init()
            );

            await init();
        }
} satisfies Thunks;
