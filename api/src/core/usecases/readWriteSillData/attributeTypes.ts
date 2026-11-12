// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { LocalizedString } from "../../ports/GetSoftwareExternalData";

export type AttributeKind = "boolean" | "string" | "number" | "date" | "url" | "enum" | "text";

export type AttributeOptionSeverity = "success" | "warning" | "error" | "info" | "new";

export const attributeCardIcons = ["computer", "france", "question", "thumbs-up", "chat", "star"] as const;

export type AttributeCardIcon = (typeof attributeCardIcons)[number];

export const attributeOptionIcons = ["check", "eye", "warning", ...attributeCardIcons] as const;

export type AttributeOptionIcon = (typeof attributeOptionIcons)[number];

export type AttributeOption = {
    value: string;
    label: LocalizedString;
    severity?: AttributeOptionSeverity;
    icon?: AttributeOptionIcon;
};

export const attributeDetailsSections = ["summary", "usages", "deployment", "similar-software", "sources"] as const;

export type AttributeDetailsSection = (typeof attributeDetailsSections)[number];

/** Identifies a dedicated subsection, whatever the shape of its stored title */
export const getDetailsSubsectionKey = (section: AttributeDetailsSection, title: LocalizedString) =>
    JSON.stringify(typeof title === "string" ? [section, title, ""] : [section, title.fr ?? "", title.en ?? ""]);

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
    displayInCardIcon: AttributeCardIcon | undefined;
    enableFiltering: boolean;
    required: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
};

export type AttributeValue = boolean | string | number | Date | null;

export type CustomAttributes = Record<string, AttributeValue>;
