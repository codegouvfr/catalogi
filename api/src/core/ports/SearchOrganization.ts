// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export type SearchOrganizationCriteria = {
    name?: string;
    identifer?: {
        base: string;
        value: string;
    };
};

export type SearchOrganization = (search: SearchOrganizationCriteria) => Promise<string[] | undefined>;
