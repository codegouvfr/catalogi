// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { AttributeDefinition, CustomAttributes } from "./readWriteSillData/attributeTypes";

/** Names of the enum and text attributes whose value does not match their definition */
export const getInvalidCustomAttributeNames = ({
    attributeDefinitions,
    customAttributes
}: {
    attributeDefinitions: AttributeDefinition[];
    customAttributes: CustomAttributes;
}): string[] =>
    attributeDefinitions
        .filter(({ name, kind, options }) => {
            const value = customAttributes[name];
            if (value === undefined || value === null) return false;

            switch (kind) {
                case "enum":
                    return !options?.some(option => option.value === value);
                case "text":
                    return typeof value !== "string";
                default:
                    return false;
            }
        })
        .map(({ name }) => name);
