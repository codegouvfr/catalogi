// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { State as RootState } from "core/bootstrap";
import { name } from "./state";

const currentAgent = (rootState: RootState) => {
    const state = rootState[name];
    return { currentAgent: state.currentUser };
};

export const selectors = { currentAgent };
