// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import { describe, it, beforeEach, expect } from "vitest";
import {
    emptyExternalData,
    emptyExternalDataCleaned,
    expectToEqual,
    expectToMatchObject,
    resetDB,
    testPgUrl
} from "../../tools/test.helpers";
import type { DbApiV2 } from "../ports/DbApiV2";
import type { SoftwareFormData } from "./readWriteSillData";
import { createKyselyPgDbApi } from "../adapters/dbApi/kysely/createPgDbApi";
import type { Database } from "../adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../adapters/dbApi/kysely/kysely.dialect";
import { makeCreateSofware } from "./createSoftware";
import { makeRefreshExternalDataForSoftware } from "./refreshExternalData";

const craSoftwareFormData = {
    softwareType: {
        type: "stack"
    },
    externalIdForSource: "Q118629387",
    sourceSlug: "wikidata",
    softwareName: "Create react app",
    softwareDescription: "To create React apps.",
    softwareLicense: "MIT",
    softwareMinimalVersion: "1.0.0",
    isPresentInSupportContract: true,
    isFromFrenchPublicService: true,
    similarSoftwareExternalDataIds: ["Q111590996" /* viteJS */],
    softwareLogoUrl: "https://example.com/logo.png",
    softwareKeywords: ["Productivity", "Task", "Management"],
    doRespectRgaa: true
} satisfies SoftwareFormData;

const apacheSoftwareId = 6;

const insertApacheWithCorrectId = async (db: Kysely<Database>, userId: number) => {
    await db
        .insertInto("softwares")
        .values({
            id: apacheSoftwareId,
            softwareType: JSON.stringify({
                type: "desktop/mobile",
                os: { ios: false, mac: false, linux: true, android: false, windows: false }
            }),
            name: "Apache HTTP Server",
            description: "Serveur Web & Reverse Proxy",
            license: "Apache-2.0",
            versionMin: "212",
            isPresentInSupportContract: true,
            isFromFrenchPublicService: false,
            logoUrl: "https://sill.code.gouv.fr/logo/apache-http.png",
            keywords: JSON.stringify(["serveur", "http", "web", "server", "apache"]),
            doRespectRgaa: false,
            isStillInObservation: false,
            workshopUrls: JSON.stringify([]),
            categories: JSON.stringify([]),
            generalInfoMd: null,
            addedByUserId: userId,
            dereferencing: null,
            referencedSinceTime: 1728462232094,
            updateTime: 1728462232094
        })
        .execute();

    await db
        .insertInto("software_external_datas")
        .values({
            externalId: "Q11354",
            sourceSlug: "wikidata",
            softwareId: apacheSoftwareId,
            developers: JSON.stringify([]),
            label: JSON.stringify({}),
            description: JSON.stringify({})
        })
        .execute();
};

const acceleroId = 2;
const insertAcceleroWithCorrectId = async (db: Kysely<Database>, userId: number) => {
    await db
        .insertInto("softwares")
        .values({
            id: acceleroId,
            softwareType: JSON.stringify({ type: "stack" }),
            name: "Acceleo",
            description: "Outil et/ou plugin de génération de tout ou partie du code",
            license: "EPL-2.0",
            versionMin: "3.7.8",
            isPresentInSupportContract: false,
            isFromFrenchPublicService: false,
            logoUrl: null,
            keywords: JSON.stringify(["modélisation", "génération", "code", "modeling", "code generation"]),
            doRespectRgaa: false,
            isStillInObservation: false,
            workshopUrls: JSON.stringify([]),
            categories: JSON.stringify(["Other Development Tools"]),
            generalInfoMd: null,
            addedByUserId: userId,
            dereferencing: null,
            referencedSinceTime: 1514764800000,
            updateTime: 1514764800000
        })
        .execute();

    await db
        .insertInto("software_external_datas")
        .values({
            externalId: "Q2822666",
            sourceSlug: "wikidata",
            softwareId: acceleroId,
            developers: JSON.stringify([]),
            label: JSON.stringify({}),
            description: JSON.stringify({})
        })
        .execute();

    return acceleroId;
};

describe("fetches software extra data (from different providers)", () => {
    let fetchAndSaveSoftwareExtraDataBySoftwareId: Awaited<ReturnType<typeof makeRefreshExternalDataForSoftware>>;
    let dbApi: DbApiV2;
    let db: Kysely<Database>;
    let craSoftwareId: number;

    beforeEach(async () => {
        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        await resetDB(db);

        await sql`SELECT setval('softwares_id_seq', 11, false)`.execute(db);

        dbApi = createKyselyPgDbApi(db);

        const userId = await dbApi.user.add({
            email: "myuser@example.com",
            organization: "myorg",
            about: "my about",
            isPublic: false,
            sub: null
        });

        const makeSoftware = makeCreateSofware(dbApi);
        craSoftwareId = await makeSoftware({
            formData: craSoftwareFormData,
            userId
        });

        await insertApacheWithCorrectId(db, userId);
        await insertAcceleroWithCorrectId(db, userId);

        fetchAndSaveSoftwareExtraDataBySoftwareId = makeRefreshExternalDataForSoftware({
            dbApi
        });
    });

    it("does nothing if the software is not found", async () => {
        const initialExternalSoftwarePackagesBeforeFetching = [
            emptyExternalData({
                "externalId": "Q2822666",
                "softwareId": 2,
                "sourceSlug": "wikidata"
            }),
            emptyExternalData({
                "externalId": "Q11354",
                "softwareId": 6,
                "sourceSlug": "wikidata"
            }),
            emptyExternalData({
                externalId: "Q118629387",
                sourceSlug: "wikidata",
                softwareId: 11
            }),
            emptyExternalData({
                externalId: "Q111590996",
                sourceSlug: "wikidata"
            })
        ];

        const softwareExternalDatas = await db
            .selectFrom("software_external_datas")
            .selectAll()
            .orderBy("softwareId", "asc")
            .execute();

        expectToMatchObject(softwareExternalDatas, initialExternalSoftwarePackagesBeforeFetching);

        await fetchAndSaveSoftwareExtraDataBySoftwareId({ softwareId: 404 });

        const updatedSoftwareExternalDatas = await db
            .selectFrom("software_external_datas")
            .selectAll()
            .orderBy("softwareId", "asc")
            .execute();

        expectToEqual(updatedSoftwareExternalDatas, initialExternalSoftwarePackagesBeforeFetching);
    });

    it(
        "gets software external data and saves it, and does not save other extra data if there is nothing relevant",
        async () => {
            const softwareExternalDatas = await db.selectFrom("software_external_datas").selectAll().execute();
            expect(softwareExternalDatas).toHaveLength(4);

            const source = await db
                .selectFrom("sources")
                .selectAll()
                .orderBy("priority", "desc")
                .executeTakeFirstOrThrow();
            if (!source) throw new Error("Source not found");

            expect(softwareExternalDatas[0].lastDataFetchAt).toBe(null);

            await fetchAndSaveSoftwareExtraDataBySoftwareId({ softwareId: craSoftwareId });

            const updatedSoftwareExternalDatas = await dbApi.softwareExternalData.getAll();

            expectToMatchObject(updatedSoftwareExternalDatas, [
                emptyExternalDataCleaned({
                    "externalId": "Q2822666",
                    "softwareId": 2,
                    "sourceSlug": "wikidata"
                }),
                emptyExternalDataCleaned({
                    "externalId": "Q11354",
                    "softwareId": 6,
                    "sourceSlug": "wikidata"
                }),
                {
                    applicationCategories: undefined,
                    description: "deprecated tool for creating React SPA using webpack as bundler",
                    developers: [],
                    documentationUrl: undefined,
                    softwareId: craSoftwareId,
                    sourceSlug: source.slug,
                    externalId: craSoftwareFormData.externalIdForSource,
                    isLibreSoftware: true,
                    keywords: [],
                    label: "create-react-app",
                    license: "MIT licence",
                    logoUrl: undefined,
                    sourceUrl: "https://github.com/facebook/create-react-app",
                    websiteUrl: "https://create-react-app.dev/",
                    programmingLanguages: [],
                    referencePublications: undefined,
                    identifiers: [
                        {
                            "@type": "PropertyValue",
                            "additionalType": "Software",
                            "name": "ID on Wikidata",
                            "subjectOf": {
                                "@type": "Website",
                                "additionalType": "wikidata",
                                "name": "Wikidata",
                                "url": new URL("https://www.wikidata.org/")
                            },
                            "url": "https://www.wikidata.org/wiki/Q118629387",
                            "value": "Q118629387"
                        }
                    ],
                    softwareVersion: "5.0.1",
                    publicationTime: new Date("2022-04-12T00:00:00.000Z"),
                    lastDataFetchAt: expect.any(Number),
                    providers: []
                },
                {
                    applicationCategories: undefined,
                    description: "open-source JavaScript module bundler",
                    developers: [
                        {
                            "@type": "Person",
                            identifiers: [
                                {
                                    value: "Q58482636",
                                    "@type": "PropertyValue"
                                }
                            ],
                            name: "Evan You",
                            url: `https://www.wikidata.org/wiki/Q58482636`
                        }
                    ],
                    documentationUrl: "https://ja.vitejs.dev/guide/",
                    sourceSlug: source.slug,
                    softwareId: undefined,
                    externalId: "Q111590996",
                    isLibreSoftware: true,
                    keywords: [],
                    label: "Vite",
                    license: "MIT licence",
                    logoUrl:
                        "//upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Vitejs-logo.svg/250px-Vitejs-logo.svg.png",
                    sourceUrl: "https://github.com/vitejs/vite",
                    websiteUrl: "https://vite.dev/",
                    programmingLanguages: ["جافا سكريبت"],
                    referencePublications: undefined,
                    identifiers: [
                        {
                            "@type": "PropertyValue",
                            "additionalType": "Software",
                            "name": "ID on Wikidata",
                            "subjectOf": {
                                "@type": "Website",
                                "additionalType": "wikidata",
                                "name": "Wikidata",
                                "url": new URL("https://www.wikidata.org/")
                            },
                            "url": "https://www.wikidata.org/wiki/Q111590996",
                            "value": "Q111590996"
                        }
                    ],
                    softwareVersion: expect.any(String),
                    publicationTime: expect.any(Date),
                    lastDataFetchAt: expect.any(Number),
                    providers: []
                }
            ]);

            const { lastDataFetchAt } = await db
                .selectFrom("software_external_datas")
                .select("lastDataFetchAt")
                .where("softwareId", "=", craSoftwareId)
                .executeTakeFirstOrThrow();
            expect(lastDataFetchAt).toBeTruthy();
        },
        { timeout: 20_000 }
    );

    it(
        "gets software external data and saves it, and save other extra data",
        async () => {
            const source = await db
                .selectFrom("sources")
                .selectAll()
                .orderBy("priority", "desc")
                .executeTakeFirstOrThrow();

            if (!source) throw new Error("Source not found");

            const softwareExternalDatas = await dbApi.softwareExternalData.getAll();
            expect(softwareExternalDatas).toHaveLength(4);

            await fetchAndSaveSoftwareExtraDataBySoftwareId({ softwareId: apacheSoftwareId });

            const updatedSoftwareExternalDatas = await dbApi.softwareExternalData.getAll();
            expectToMatchObject(updatedSoftwareExternalDatas, [
                emptyExternalDataCleaned({
                    "externalId": "Q2822666",
                    "softwareId": 2,
                    "sourceSlug": "wikidata"
                }),
                {
                    applicationCategories: undefined,
                    description: {
                        en: "open-source web server software",
                        fr: "serveur web sous licence libre"
                    },
                    developers: [
                        {
                            "@type": "Organization",
                            identifiers: [
                                {
                                    value: "Q489709",
                                    "additionalType": "Organization",
                                    "name": "ID on Wikidata",
                                    "subjectOf": {
                                        "@type": "Website",
                                        "additionalType": "wikidata",
                                        "name": "Wikidata",
                                        "url": new URL("https://www.wikidata.org/")
                                    },
                                    "url": "https://www.wikidata.org/wiki/Q489709",
                                    "@type": "PropertyValue"
                                }
                            ],
                            name: "Apache Software Foundation",
                            url: "https://www.wikidata.org/wiki/Q489709"
                        }
                    ],
                    documentationUrl: undefined,
                    sourceSlug: source.slug,
                    softwareId: apacheSoftwareId,
                    externalId: "Q11354",
                    isLibreSoftware: false,
                    keywords: [],
                    label: "Apache HTTP Server",
                    license: "Apache License v2.0",
                    logoUrl:
                        "//upload.wikimedia.org/wikipedia/commons/thumb/1/10/Apache_HTTP_server_logo_%282019-present%29.svg/250px-Apache_HTTP_server_logo_%282019-present%29.svg.png",
                    sourceUrl: "https://svn.apache.org/viewvc/httpd/httpd/",
                    websiteUrl: "https://httpd.apache.org/",
                    referencePublications: undefined,
                    identifiers: [
                        {
                            "@type": "PropertyValue",
                            "additionalType": "Software",
                            "name": "ID on Wikidata",
                            "subjectOf": {
                                "@type": "Website",
                                "additionalType": "wikidata",
                                "name": "Wikidata",
                                "url": new URL("https://www.wikidata.org/")
                            },
                            "url": "https://www.wikidata.org/wiki/Q11354",
                            "value": "Q11354"
                        }
                    ],
                    programmingLanguages: ["Си"],
                    softwareVersion: "2.5.0-alpha",
                    publicationTime: new Date("2017-11-08T00:00:00.000Z"),
                    lastDataFetchAt: expect.any(Number),
                    providers: []
                },
                emptyExternalDataCleaned({
                    externalId: "Q118629387",
                    sourceSlug: "wikidata",
                    softwareId: 11
                }),
                emptyExternalDataCleaned({
                    externalId: "Q111590996",
                    sourceSlug: "wikidata"
                })
            ]);
        },
        { timeout: 20_000 }
    );
});
