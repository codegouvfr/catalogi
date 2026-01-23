// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createUsecaseActions } from "redux-clean-architecture";
import { id } from "tsafe/id";
import type { ApiTypes } from "api";

export type State = State.NotReady | State.Ready;

export namespace State {
    export type NotReady = {
        stateDescription: "not ready";
        isInitializing: boolean;
    };

    export type Ready = {
        stateDescription: "ready";
        softwareId: number;
        softwareName: string;
        logoUrl: string | undefined;
        users: SoftwareUser[];
        referents: SoftwareReferent[];
    };

    export type SoftwareUser = {
        organization: string | null;
        usecaseDescription: string;
        /** NOTE: undefined if the software is not of type desktop/mobile */
        os: ApiTypes.Os | undefined;
        version: string;
        /** NOTE: Defined only when software is cloud */
        serviceUrl: string | undefined;
    };

    export type SoftwareReferent = {
        email: string;
        organization: string | null;
        isTechnicalExpert: boolean;
        usecaseDescription: string;
        /** NOTE: Can be not undefined only if cloud */
        serviceUrl: string | undefined;
    };
}

export const name = "softwareUserAndReferent" as const;

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: id<State>({
        stateDescription: "not ready",
        isInitializing: false
    }),
    reducers: {
        initializationStarted: () => ({
            stateDescription: "not ready" as const,
            isInitializing: true
        }),
        initializationCompleted: (
            _state,
            {
                payload
            }: {
                payload: {
                    softwareId: number;
                    softwareName: string;
                    logoUrl: string | undefined;
                    users: State.SoftwareUser[];
                    referents: State.SoftwareReferent[];
                };
            }
        ) => {
            const { softwareId, softwareName, logoUrl, users, referents } = payload;

            return {
                stateDescription: "ready",
                softwareId,
                softwareName,
                logoUrl,
                users,
                referents
            };
        },
        cleared: () => ({
            stateDescription: "not ready" as const,
            isInitializing: false
        })
    }
});
