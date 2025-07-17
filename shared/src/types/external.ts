// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { Language } from "../constants/languages";
import type { Catalogi } from "./catalogi";

// Use a more flexible type that allows both string and localized object
export type LocalizedString = string | Partial<Record<Language, string>>;

export type ExternalDataOrigin = "wikidata" | "HAL";

export type SoftwareExternalData = {
    externalId: string;
    sourceSlug: string;
    developers: Array<Catalogi.Person | Catalogi.Organization>;
    label: LocalizedString;
    description: LocalizedString;
    isLibreSoftware: boolean;
} & Partial<{
    logoUrl: string;
    websiteUrl: string;
    sourceUrl: string;
    documentationUrl: string;
    license: string;
    softwareVersion: string;
    keywords: string[];
    programmingLanguages: string[];
    applicationCategories: string[];
    publicationTime: Date;
    referencePublications: Catalogi.ScholarlyArticle[];
    identifiers: Catalogi.Identification[];
}>;

export type SimilarSoftwareExternalData = {
    externalId: string;
    sourceSlug: string;
    label: LocalizedString;
    description: LocalizedString;
    isLibreSoftware: boolean;
};

export type SoftwareExternalDataOption = {
    externalId: string;
    label: LocalizedString;
    description: LocalizedString;
    isLibreSoftware: boolean;
};

export type GetSoftwareExternalDataOptions = {
    queryString: string;
    source: {
        slug: string;
        kind: Catalogi.SourceKind;
        url: string;
        priority: number;
        description: LocalizedString | null;
    };
};