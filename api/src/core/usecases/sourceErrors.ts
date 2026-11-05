// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export class SourceNotFoundError extends Error {
    constructor(slug: string) {
        super(`Source "${slug}" not found`);
        this.name = "SourceNotFoundError";
    }
}

export class SourceNotEditableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SourceNotEditableError";
    }
}

export class InvalidSourceConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidSourceConfigurationError";
    }
}

export class InvalidCategoryOrderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidCategoryOrderError";
    }
}

export class NotALookupSourceCandidateError extends Error {
    constructor(slug: string) {
        super(`Source "${slug}" cannot be queried by name, it cannot be the lookup source`);
        this.name = "NotALookupSourceCandidateError";
    }
}
