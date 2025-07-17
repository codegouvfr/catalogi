// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { z } from "zod";
import { assert, type Equals } from "tsafe/assert";
import {
    Source,
    ExternalDataOrigin,
    SoftwareExternalData,
    SimilarSoftwareExternalData,
    Language,
    languages,
    LocalizedString
} from "shared";

type ExternalId = string;

// Re-export from shared for convenience
export type { ExternalDataOrigin, SoftwareExternalData, SimilarSoftwareExternalData, Language, LocalizedString };
export { languages };

export type GetSoftwareExternalData = {
    (params: { externalId: ExternalId; source: Source }): Promise<SoftwareExternalData | undefined>;
    clear: (externalId: ExternalId) => void;
};

const zLanguage = z.union([z.literal("en"), z.literal("fr")]);

{
    type Got = ReturnType<(typeof zLanguage)["parse"]>;
    type Expected = Language;

    assert<Equals<Got, Expected>>();
}
