// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Thunks } from "core/bootstrap";
import { actions } from "./state";

export const thunks = {};

export const protectedThunks = {
    initialize:
        () =>
        async (...args) => {
            const [dispatch, , { sillApi }] = args;

            dispatch(
                actions.initialized({
                    softwareNameBySillId: Object.fromEntries(
                        (await sillApi.getSoftwareList()).map(({ id, softwareName }) => [
                            id,
                            softwareName
                        ])
                    )
                })
            );
        }
} satisfies Thunks;
