// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

/*
In this file we export utilities for using the core in a React setup.  
This file is the only place in src/core where it's okay to assume we are 
using react.  
If we where to change our UI framework we would only update this file to
export an API more adapted to our new front. (But we don't plan to leave React)
*/
import { createReactApi } from "redux-clean-architecture/react";
import { bootstrapCore } from "./bootstrap";

export const { createCoreProvider, useCore, useCoreState } = createReactApi({
    bootstrapCore
});
