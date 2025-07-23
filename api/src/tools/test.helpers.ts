// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { expect } from "vitest";
import { DeclarationFormData, InstanceFormData, SoftwareFormData, Source } from "../core/usecases/readWriteSillData";
import { Kysely } from "kysely";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { ExternalDataOriginKind } from "../lib/ApiTypes";

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

export const emptyExternalData = (params: { softwareId?: number; externalId: string; sourceSlug: string }) => {
    const { softwareId = null, externalId, sourceSlug } = params;
    return {
        externalId,
        developers: [],
        label: {},
        description: {},
        isLibreSoftware: null,
        logoUrl: null,
        websiteUrl: null,
        sourceUrl: null,
        documentationUrl: null,
        license: null,
        softwareVersion: null,
        publicationTime: null,
        keywords: null,
        programmingLanguages: null,
        applicationCategories: null,
        referencePublications: null,
        identifiers: null,
        sourceSlug,
        softwareId,
        lastDataFetchAt: null,
        providers: null
    };
};

export const emptyExternalDataCleaned = (params: { softwareId?: number; externalId: string; sourceSlug: string }) => {
    const { softwareId = undefined, externalId, sourceSlug } = params;
    return {
        externalId,
        developers: [],
        label: {},
        description: {},
        isLibreSoftware: undefined,
        logoUrl: undefined,
        websiteUrl: undefined,
        sourceUrl: undefined,
        documentationUrl: undefined,
        license: undefined,
        softwareVersion: undefined,
        publicationTime: undefined,
        keywords: undefined,
        programmingLanguages: undefined,
        applicationCategories: undefined,
        referencePublications: undefined,
        identifiers: undefined,
        sourceSlug,
        softwareId,
        lastDataFetchAt: undefined,
        providers: undefined
    };
};

export const testSource = {
    slug: "wikidata",
    priority: 1,
    url: "https://www.wikidata.org",
    description: undefined,
    kind: "wikidata"
} satisfies Source;

export const resetDB = async (db: Kysely<Database>) => {
    await db.deleteFrom("software_external_datas").execute();
    await db.deleteFrom("software_users").execute();
    await db.deleteFrom("software_referents").execute();
    await db.deleteFrom("softwares").execute();
    await db.deleteFrom("users").execute();
    await db.deleteFrom("sources").execute();

    return db
        .insertInto("sources")
        .values({
            ...testSource,
            kind: testSource.kind as ExternalDataOriginKind
        })
        .execute();
};
