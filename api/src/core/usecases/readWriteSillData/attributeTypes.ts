// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { LocalizedString } from "../../ports/GetSoftwareExternalData";

export type AttributeKind = "boolean" | "string" | "number" | "date" | "url" | "enum" | "text";

export type AttributeOptionSeverity = "success" | "warning" | "error" | "info" | "new";

export type AttributeOption = {
    value: string;
    label: LocalizedString;
    severity?: AttributeOptionSeverity;
};

export const attributeDetailsSections = ["summary", "usages", "deployment", "similar-software", "sources"] as const;

export type AttributeDetailsSection = (typeof attributeDetailsSections)[number];

export type AttributeDefinition = {
    name: string;
    kind: AttributeKind;
    label: LocalizedString;
    description?: LocalizedString;
    options?: AttributeOption[];
    displayInForm: boolean;
    editableByAdminOnly: boolean;
    displayInDetails: boolean;
    /** Section of the details page; outside the summary presentation, a subsection title is required */
    detailsSection: AttributeDetailsSection;
    detailsSubsection?: LocalizedString;
    displayInCardIcon: "computer" | "france" | "question" | "thumbs-up" | "chat" | "star" | undefined;
    enableFiltering: boolean;
    required: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
};

export type AttributeValue = boolean | string | number | Date | null;

export type CustomAttributes = Record<string, AttributeValue>;
