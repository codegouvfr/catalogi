// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ApiTypes } from "api";
import type { FrIconClassName } from "@codegouvfr/react-dsfr/fr/generatedFromCss/classNames";

export type AttributeCardIcon = NonNullable<
    ApiTypes.AttributeDefinition["displayInCardIcon"]
>;

export const iconClassByValue: Record<AttributeCardIcon, FrIconClassName> = {
    computer: "fr-icon-computer-line",
    france: "fr-icon-france-line",
    question: "fr-icon-questionnaire-line",
    "thumbs-up": "fr-icon-thumb-up-line",
    chat: "fr-icon-chat-2-line",
    star: "fr-icon-star-line"
};

export const attributeCardIconValues = Object.keys(
    iconClassByValue
) as AttributeCardIcon[];
