// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ExternalDataOriginKind, SourceConfig } from "../adapters/dbApi/kysely/kysely.database";
import { InvalidSourceConfigurationError } from "./sourceErrors";

// The credential is always stored under `auth`; its meaning depends on the kind.
export type SourceCredentialKind = "token" | "bearerToken" | "clientId";
export type SourceSettingKey = "queryTimeout" | "rateLimitRetryDuration";

export type SourceConfigurationFields = {
    credential: SourceCredentialKind | undefined;
    settings: SourceSettingKey[];
};

// Mirrors the configuration keys each adapter actually reads.
export const sourceConfigurationFieldsByKind: Record<ExternalDataOriginKind, SourceConfigurationFields> = {
    GitHub: { credential: "token", settings: ["queryTimeout"] },
    GitLab: { credential: "token", settings: ["queryTimeout"] },
    wikidata: { credential: "bearerToken", settings: ["queryTimeout", "rateLimitRetryDuration"] },
    HAL: { credential: "bearerToken", settings: ["queryTimeout", "rateLimitRetryDuration"] },
    Zenodo: { credential: "bearerToken", settings: ["queryTimeout", "rateLimitRetryDuration"] },
    ROR: { credential: "clientId", settings: ["rateLimitRetryDuration"] },
    ComptoirDuLibre: { credential: undefined, settings: [] },
    CNLL: { credential: undefined, settings: [] },
    RNSR: { credential: undefined, settings: [] },
    UserInput: { credential: undefined, settings: [] }
};

const credentialKey = "auth" satisfies keyof SourceConfig;

// What an admin can read back: never the credential itself, nor the values of keys the
// form does not manage.
export type SourceConfigurationView = {
    isCredentialSet: boolean;
    settings: Partial<Record<SourceSettingKey, number>>;
    otherKeys: string[];
};

export type SourceConfigurationPatch = {
    // `null` removes the setting, an omitted key keeps it.
    settings?: Partial<Record<SourceSettingKey, number | null>>;
    // Omitted keeps the current credential.
    credential?: { action: "replace"; value: string } | { action: "clear" };
};

export const toSourceConfigurationView = (params: {
    kind: ExternalDataOriginKind;
    configuration: SourceConfig | undefined;
}): SourceConfigurationView => {
    const { kind, configuration = {} } = params;
    const fields = sourceConfigurationFieldsByKind[kind];
    const managedKeys = new Set<string>([...(fields.credential ? [credentialKey] : []), ...fields.settings]);

    const settings: SourceConfigurationView["settings"] = {};
    for (const key of fields.settings) {
        const value = configuration[key];
        if (typeof value === "number") settings[key] = value;
    }

    return {
        isCredentialSet: fields.credential !== undefined && !!configuration[credentialKey],
        settings,
        otherKeys: Object.keys(configuration)
            .filter(key => !managedKeys.has(key))
            .sort()
    };
};

// Unknown keys are kept as is: only the fields of the kind are touched.
export const applySourceConfigurationPatch = (params: {
    kind: ExternalDataOriginKind;
    configuration: SourceConfig | undefined;
    patch: SourceConfigurationPatch;
}): SourceConfig => {
    const { kind, configuration = {}, patch } = params;
    const fields = sourceConfigurationFieldsByKind[kind];
    const next: Record<string, unknown> = { ...configuration };

    for (const [key, value] of Object.entries(patch.settings ?? {})) {
        if (!(fields.settings as string[]).includes(key))
            throw new InvalidSourceConfigurationError(`"${key}" is not a setting of ${kind} sources`);
        if (value === undefined) continue;
        if (value === null) {
            delete next[key];
            continue;
        }
        if (!Number.isInteger(value) || value <= 0)
            throw new InvalidSourceConfigurationError(`"${key}" must be a positive number of milliseconds`);
        next[key] = value;
    }

    if (patch.credential !== undefined) {
        if (fields.credential === undefined)
            throw new InvalidSourceConfigurationError(`${kind} sources take no credential`);
        if (patch.credential.action === "clear") {
            delete next[credentialKey];
        } else {
            const value = patch.credential.value.trim();
            if (value === "") throw new InvalidSourceConfigurationError("The credential cannot be empty");
            next[credentialKey] = value;
        }
    }

    return next as SourceConfig;
};
