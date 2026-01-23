// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { assert } from "tsafe/assert";
import { exclude } from "tsafe/exclude";
import { name, actions, type State } from "./state";

export const thunks = {
    initialize:
        (params: { softwareId: number }) =>
        async (...args) => {
            const { softwareId } = params;

            const [dispatch, getState, { sillApi }] = args;

            {
                const state = getState()[name];

                if (state.stateDescription === "not ready" && state.isInitializing) {
                    return;
                }
            }

            dispatch(actions.initializationStarted());

            const software = (await sillApi.getSoftwareList()).find(
                software => software.id === softwareId
            );

            assert(software !== undefined);

            const softwareName = software.softwareName;

            const { users } = await sillApi.getUsers();

            const softwareUsers: State.SoftwareUser[] = [];
            const softwareReferents: State.SoftwareReferent[] = [];

            for (const agent of users) {
                user: {
                    const declaration = agent.declarations
                        .map(declaration =>
                            declaration.declarationType === "user"
                                ? declaration
                                : undefined
                        )
                        .filter(exclude(undefined))
                        .find(declaration => declaration.softwareName === softwareName);

                    if (declaration === undefined) {
                        break user;
                    }

                    softwareUsers.push({
                        organization: agent.organization,
                        os: declaration.os,
                        serviceUrl: declaration.serviceUrl,
                        usecaseDescription: declaration.usecaseDescription,
                        version: declaration.version
                    });
                }

                referent: {
                    const declaration = agent.declarations
                        .map(declaration =>
                            declaration.declarationType === "referent"
                                ? declaration
                                : undefined
                        )
                        .filter(exclude(undefined))
                        .find(declaration => declaration.softwareName === softwareName);

                    if (declaration === undefined) {
                        break referent;
                    }

                    const { email } = agent;

                    assert(email !== undefined);

                    softwareReferents.push({
                        email,
                        organization: agent.organization,
                        isTechnicalExpert: declaration.isTechnicalExpert,
                        serviceUrl: declaration.serviceUrl,
                        usecaseDescription: declaration.usecaseDescription
                    });
                }
            }

            dispatch(
                actions.initializationCompleted({
                    softwareId,
                    softwareName,
                    logoUrl: software.logoUrl,
                    users: softwareUsers,
                    referents: softwareReferents
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
        }
} satisfies Thunks;
