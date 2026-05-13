// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { DbApiV2 } from "../ports/DbApiV2";
import type { SoftwareFormData } from "./readWriteSillData";

export const sanitizeSoftwareFormDataCustomAttributes = async ({
    dbApi,
    formData,
    isAdmin,
    softwareId
}: {
    dbApi: DbApiV2;
    formData: SoftwareFormData;
    isAdmin: boolean;
    softwareId?: number;
}): Promise<SoftwareFormData> => {
    if (isAdmin) return formData;

    const adminOnlyNames = await getAdminOnlyAttributeNames({ dbApi });
    if (adminOnlyNames.length === 0) return formData;

    const editableCustomAttributes = removeAdminOnlyAttributes({
        customAttributes: formData.customAttributes ?? {},
        adminOnlyNames
    });

    if (softwareId === undefined) {
        return { ...formData, customAttributes: editableCustomAttributes };
    }

    const existingSoftware = await dbApi.software.getBySoftwareId(softwareId);
    const customAttributes = restoreExistingAdminOnlyAttributes({
        customAttributes: editableCustomAttributes,
        existingCustomAttributes: existingSoftware?.customAttributes ?? {},
        adminOnlyNames
    });

    return { ...formData, customAttributes };
};

const getAdminOnlyAttributeNames = async ({ dbApi }: { dbApi: DbApiV2 }): Promise<string[]> =>
    (await dbApi.attributeDefinition.getAll()).filter(def => def.editableByAdminOnly).map(def => def.name);

const removeAdminOnlyAttributes = ({
    customAttributes,
    adminOnlyNames
}: {
    customAttributes: NonNullable<SoftwareFormData["customAttributes"]>;
    adminOnlyNames: string[];
}): NonNullable<SoftwareFormData["customAttributes"]> => {
    const adminOnlyNameSet = new Set(adminOnlyNames);

    return Object.fromEntries(Object.entries(customAttributes).filter(([name]) => !adminOnlyNameSet.has(name)));
};

const restoreExistingAdminOnlyAttributes = ({
    customAttributes,
    existingCustomAttributes,
    adminOnlyNames
}: {
    customAttributes: NonNullable<SoftwareFormData["customAttributes"]>;
    existingCustomAttributes: NonNullable<SoftwareFormData["customAttributes"]>;
    adminOnlyNames: string[];
}): NonNullable<SoftwareFormData["customAttributes"]> => {
    const restoredCustomAttributes = { ...customAttributes };

    for (const name of adminOnlyNames) {
        if (Object.hasOwn(existingCustomAttributes, name)) {
            restoredCustomAttributes[name] = existingCustomAttributes[name];
        }
    }

    return restoredCustomAttributes;
};
