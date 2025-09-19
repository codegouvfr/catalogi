// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export namespace Catalogi {
    export type SourceKind =
        | "GitLab"
        | "HAL"
        | "wikidata"
        | "SWH"
        | "Orcid"
        | "doi"
        | "GitHub"
        | "ComptoirDuLibre"
        | "FramaLibre"
        | "CNLL"
        | "Zenodo";
}
