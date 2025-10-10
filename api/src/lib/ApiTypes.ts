// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export type { SoftwareExternalDataOption } from "../core/ports/GetSoftwareExternalDataOptions";
export type { GetSoftwareExternalDataOptions } from "../core/ports/GetSoftwareExternalDataOptions";
export type { Catalogi } from "../types/Catalogi";

export type {
    ExternalDataOriginKind,
    SchemaIdentifier as Identifier,
    SchemaPerson as Person,
    SchemaOrganization as Organization,
    ScholarlyArticle
} from "../core/adapters/dbApi/kysely/kysely.database";

export type {
    CreateUserParams,
    UserWithId,
    Instance,
    Os,
    Software,
    SoftwareFormData,
    DeclarationFormData,
    InstanceFormData,
    SoftwareType,
    ServiceProvider,
    Source
} from "../core/usecases/readWriteSillData";

export type {
    CustomAttributes,
    AttributeValue,
    AttributeKind,
    AttributeDefinition
} from "../core/usecases/readWriteSillData/attributeTypes";

export type { UiConfig, ConfigurableUseCaseName } from "../core/uiConfigSchema";

export type Translations = { translations: typeof import("../rpc/translations/en_default.json") };
