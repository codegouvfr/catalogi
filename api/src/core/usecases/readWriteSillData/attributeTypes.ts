// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { LocalizedString } from "../../ports/GetSoftwareExternalData";

export type AttributeKind = "boolean" | "string" | "number" | "date" | "url";

export type AttributeDefinition = {
    name: string;
    kind: AttributeKind;
    label: LocalizedString;
    description?: LocalizedString;
    displayInForm: boolean;
    displayInDetails: boolean;
    displayInCardIcon: "computer" | "france" | "question" | "thumbs-up" | "chat" | "star" | undefined;
    enableFiltering: boolean;
    required: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
};

export type AttributeValue = boolean | string | number | Date | null;

export type CustomAttributes = Record<string, AttributeValue>;
