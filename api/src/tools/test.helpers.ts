// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { expect } from "vitest";
import { DeclarationFormData, InstanceFormData, SoftwareFormData } from "shared";

export const testPgUrl = "postgresql://catalogi:pg_password@localhost:5432/db";

export const expectPromiseToFailWith = (promise: Promise<any>, errorMessage: string) => {
    return expect(promise).rejects.toThrow(errorMessage);
};

export const expectToEqual = <T>(actual: T, expected: T) => {
    expect(actual).toEqual(expected);
};

export const expectToMatchObject = <T>(actual: T, expected: Partial<T>) => {
    expect(actual).toMatchObject(expected);
};

const makeObjectFactory =
    <T>(defaultValue: T) =>
    (overloads: Partial<T> = {}): T => ({
        ...defaultValue,
        ...overloads
    });

export const createDeclarationFormData = makeObjectFactory<DeclarationFormData>({
    declarationType: "user",
    os: "mac",
    serviceUrl: "https://example.com",
    usecaseDescription: "My description",
    version: "1"
});

export const createSoftwareFormData = makeObjectFactory<SoftwareFormData>({
    softwareType: {
        type: "desktop/mobile",
        os: {
            windows: true,
            linux: true,
            mac: true,
            android: false,
            ios: false
        }
    },
    externalIdForSource: "Q171985",
    sourceSlug: "some-source-slug",
    comptoirDuLibreId: undefined,
    softwareName: "Some software",
    softwareDescription: "Some software description",
    softwareLicense: "Some software license",
    softwareMinimalVersion: "1.0.0",
    isPresentInSupportContract: true,
    isFromFrenchPublicService: true,
    similarSoftwareExternalDataIds: ["some-external-id"],
    softwareLogoUrl: "https://example.com/logo.png",
    softwareKeywords: ["some", "keywords"],
    doRespectRgaa: true
});
export const createInstanceFormData = makeObjectFactory<InstanceFormData>({
    organization: "Default organization",
    targetAudience: "Default audience",
    mainSoftwareSillId: 1,
    instanceUrl: "https://example.com",
    isPublic: true
});
