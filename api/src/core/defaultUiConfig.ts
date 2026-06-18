// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import rawUiConfig from "../customization/ui-config.json";
import { uiConfigSchema, type UiConfig } from "./uiConfigSchema";

// Default UI configuration, loaded from the bundled ui-config.json (whose path is
// overridable by a mounted volume / ConfigMap in deployments). Used to seed the
// config_ui table when it is empty, and as a defensive fallback when reading.
export const defaultUiConfig: UiConfig = uiConfigSchema.parse(rawUiConfig);
