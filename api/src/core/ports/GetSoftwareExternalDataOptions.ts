// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { z } from "zod";
import { Source } from "../usecases/readWriteSillData";
import { LocalizedString, type Language } from "./GetSoftwareExternalData";

export type SoftwareExternalDataOption = {
    externalId: string;
    label: LocalizedString;
    description: LocalizedString;
    isLibreSoftware: boolean | undefined;
    sourceSlug: string;
};

const localizedStringSchema = z.string().or(
    z
        .object({
            fr: z.string().optional(),
            en: z.string().optional()
        })
        .partial()
);

export const softwareExternalDataOptionSchema = z.object({
    externalId: z.string(),
    label: localizedStringSchema,
    description: localizedStringSchema,
    isLibreSoftware: z.boolean(),
    sourceSlug: z.string()
});

export type GetSoftwareExternalDataOptions = (params: {
    queryString: string;
    language: Language;
    source: Source;
}) => Promise<SoftwareExternalDataOption[]>;
