// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ExternalDataOrigin } from "shared";
import type { Thunks } from "core/bootstrap";
import { createUsecaseContextApi } from "redux-clean-architecture";

const { getContext, setContext } = createUsecaseContextApi<{
    externalDataOrigin: ExternalDataOrigin;
}>();

export const thunks = {
    getExternalDataOrigin:
        () =>
        (...args): ExternalDataOrigin => {
            const [, , rootContext] = args;

            const { externalDataOrigin } = getContext(rootContext);

            return externalDataOrigin;
        }
} satisfies Thunks;

export const protectedThunks = {
    initialize:
        () =>
        async (...args) => {
            const [, , rootContext] = args;

            const { sillApi } = rootContext;

            setContext(rootContext, {
                externalDataOrigin: await sillApi.getExternalSoftwareDataOrigin()
            });
        }
} satisfies Thunks;
