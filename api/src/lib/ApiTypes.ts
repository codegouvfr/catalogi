// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export type { ExternalDataOrigin } from "../core/ports/GetSoftwareExternalData";
export type { SoftwareExternalDataOption } from "../core/ports/GetSoftwareExternalDataOptions";
export type { GetSoftwareExternalDataOptions } from "../core/ports/GetSoftwareExternalDataOptions";
export type { Catalogi } from "../types/Catalogi";

export type {
    CreateUserParams,
    UserWithId,
    Instance,
    Os,
    Prerogative,
    Software,
    SoftwareFormData,
    DeclarationFormData,
    InstanceFormData,
    SoftwareType,
    ServiceProvider,
    Source
} from "../core/usecases/readWriteSillData";

export type { UiConfig, ConfigurableUseCaseName } from "../core/uiConfigSchema";

export type Translations = { translations: typeof import("../rpc/translations/en_default.json") };
