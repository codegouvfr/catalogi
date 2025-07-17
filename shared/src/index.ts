// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

// Constants
export type { Language } from "./constants/languages";
export { languages } from "./constants/languages";

// Domain types
export type {
  Agent,
  Instance,
  Os,
  Prerogative,
  Software,
  ServiceProvider,
  Source,
  SoftwareType,
  DeclarationFormData,
} from "./types/domain";

// Form types
export type { SoftwareFormData, InstanceFormData } from "./types/forms";

// External data types
export type {
  ExternalDataOrigin,
  LocalizedString,
  SoftwareExternalData,
  SimilarSoftwareExternalData,
  SoftwareExternalDataOption,
  GetSoftwareExternalDataOptions,
} from "./types/external";

// Catalogi namespace
export type { Catalogi } from "./types/catalogi";

// UI config types
export type { UiConfig, ConfigurableUseCaseName } from "./types/ui";

export type { User } from "./types/user";

export * from "./types/utils"
