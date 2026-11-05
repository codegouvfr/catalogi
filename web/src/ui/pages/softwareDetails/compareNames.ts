// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

/** Alphabetical order in the interface language, ignoring case and accents */
export const getNameComparator = (lang: string) =>
    new Intl.Collator(lang, { sensitivity: "base" }).compare;
