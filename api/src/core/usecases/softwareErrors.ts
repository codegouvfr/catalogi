// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export class SoftwareNotFoundError extends Error {
    constructor() {
        super("Software not found");
        this.name = "SoftwareNotFoundError";
    }
}

export class SoftwareAlreadyExistsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SoftwareAlreadyExistsError";
    }
}

export class SoftwareEditionProtectedError extends Error {
    constructor() {
        super("Software is protected from editing");
        this.name = "SoftwareEditionProtectedError";
    }
}

export class SoftwareDereferencingProtectedError extends Error {
    constructor() {
        super("Software is protected from unreferencing");
        this.name = "SoftwareDereferencingProtectedError";
    }
}

export class ProtectionReasonRequiredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProtectionReasonRequiredError";
    }
}
