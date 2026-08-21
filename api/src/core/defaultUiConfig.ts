// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import rawUiConfig from "../customization/ui-config.json";
import { uiConfigSchema, type UiConfig } from "./uiConfigSchema";

// Existing deployments can still mount ui-config.json. Its validated value initializes
// PostgreSQL once; subsequent application starts preserve admin changes made at runtime.
export const getDefaultUiConfig = (): UiConfig => uiConfigSchema.parse(rawUiConfig);
