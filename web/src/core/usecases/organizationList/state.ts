// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Organization } from "api/dist/src/lib/ApiTypes";
import {
    createUsecaseActions,
    createObjectThatThrowsIfAccessed
} from "redux-clean-architecture";

export type State = {
    stateDescription: string;
    error: string | undefined;
    selected: Organization | undefined; // TODO use a system of key
    filtered: Array<Organization> | undefined; // TODO use a system of key
    list: Array<Organization>;
};

export const name = "organizationList" as const;

export const { reducer, actions } = createUsecaseActions({
    name,
    initialState: createObjectThatThrowsIfAccessed<State>(),
    reducers: {
        initialized: (_state, { payload }: { payload: State }) => payload
    }
});
