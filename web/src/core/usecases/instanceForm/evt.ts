// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { CreateEvt } from "core/bootstrap";
import { assert } from "tsafe/assert";
import { name } from "./state";

export const createEvt = (({ evtAction, getState }) =>
    evtAction.pipe(action => {
        if (action.usecaseName === name && action.actionName === "formSubmitted") {
            const state = getState()[name];
            assert(state.stateDescription === "ready");

            const software = state.allSillSoftwares.find(
                s => s.name === action.payload.name
            );
            assert(software !== undefined);

            return [
                {
                    action: "redirect" as const,
                    softwareName: action.payload.name,
                    softwareId: software.softwareSillId
                }
            ];
        }
        return null;
    })) satisfies CreateEvt;
