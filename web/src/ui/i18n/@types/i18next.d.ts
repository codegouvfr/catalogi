// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Translations } from "api/src/lib";

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "translations";
        resources: Translations;
    }
}
