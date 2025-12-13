// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { CreateEvt } from "core/bootstrap";
import { assert } from "tsafe/assert";
import { name } from "./state";

export const createEvt = (({ evtAction, getState }) => {
    return evtAction.pipe(action =>
        action.usecaseName === name && action.actionName === "triggerRedirect"
            ? [
                  {
                      action: "redirect" as const,
                      softwareId: (() => {
                          const state = getState()[name];

                          assert(state.stateDescription === "ready");

                          return state.software.softwareId;
                      })()
                  }
              ]
            : null
    );
}) satisfies CreateEvt;
