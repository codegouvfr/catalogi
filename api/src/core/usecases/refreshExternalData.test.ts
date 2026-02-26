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
import { SoftwareExternalDataOption } from "../ports/GetSoftwareExternalDataOptions";

const viteOption: SoftwareExternalDataOption = {
    externalId: "Q111590996" /* viteJS */,
    sourceSlug: "wikidata",
    name: "Vite JS",
    description: "Vite JS is a build tool for modern web development.",
    isLibreSoftware: true
};

const craSoftwareFormData = {
    operatingSystems: {},
    runtimePlatforms: [],
    externalIdForSource: "Q118629387",
    sourceSlug: "wikidata",
    name: "Create react app",
    description: "To create React apps.",
    license: "MIT",
    similarSoftwareExternalDataItems: [viteOption],
    image: "https://example.com/logo.png",
    keywords: ["Productivity", "Task", "Management"],
    customAttributes: {
        isPresentInSupportContract: true,
        isFromFrenchPublicService: true,
        doRespectRgaa: true
    }
} satisfies SoftwareFormData;

const apacheSoftwareId = 6;

const insertApacheWithCorrectId = async (db: Kysely<Database>, userId: number) => {
    await db
        .insertInto("softwares")
        .values({
            id: apacheSoftwareId,
            operatingSystems: JSON.stringify({ ios: false, mac: false, linux: true, android: false, windows: false }),
            runtimePlatforms: JSON.stringify(["desktop"]),
            name: "Apache HTTP Server",
            description: JSON.stringify({ fr: "Serveur Web & Reverse Proxy" }),
            license: "Apache-2.0",
            image: "https://sill.code.gouv.fr/logo/apache-http.png",
            keywords: JSON.stringify(["serveur", "http", "web", "server", "apache"]),
            isStillInObservation: false,
            applicationCategories: JSON.stringify([]),
            addedByUserId: userId,
            dereferencing: null,
            addedTime: new Date(1728462232094).toISOString(),
            updateTime: new Date(1728462232094).toISOString(),
            customAttributes: JSON.stringify({
                isPresentInSupportContract: true,
                isFromFrenchPublicService: false,
                doRespectRgaa: false
            })
        })
        .execute();

    await db
        .insertInto("software_external_datas")
        .values({
            externalId: "Q11354",
            sourceSlug: "wikidata",
            softwareId: apacheSoftwareId,
            authors: JSON.stringify([]),
            name: JSON.stringify(""),
            description: JSON.stringify("")
        })
        .execute();
};

const acceleroId = 2;
const insertAcceleroWithCorrectId = async (db: Kysely<Database>, userId: number) => {
    await db
        .insertInto("softwares")
        .values({
            id: acceleroId,
            operatingSystems: JSON.stringify({}),
            runtimePlatforms: JSON.stringify([]),
            name: "Acceleo",
            description: JSON.stringify({ fr: "Outil et/ou plugin de génération de tout ou partie du code" }),
            license: "EPL-2.0",
            image: null,
            keywords: JSON.stringify(["modélisation", "génération", "code", "modeling", "code generation"]),
            isStillInObservation: false,
            applicationCategories: JSON.stringify(["Other Development Tools"]),
            addedByUserId: userId,
            dereferencing: null,
            addedTime: new Date(1514764800000).toISOString(),
            updateTime: new Date(1514764800000).toISOString(),
            customAttributes: JSON.stringify({
                isPresentInSupportContract: false,
                isFromFrenchPublicService: false,
                doRespectRgaa: false
            })
        })
        .execute();

    await db
        .insertInto("software_external_datas")
        .values({
            externalId: "Q2822666",
            sourceSlug: "wikidata",
            softwareId: acceleroId,
            authors: JSON.stringify([]),
            name: JSON.stringify(""),
            description: JSON.stringify("")
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
                sourceSlug: "wikidata",
                name: viteOption.name,
                description: viteOption.description,
                isLibreSoftware: viteOption.isLibreSoftware
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
                    applicationCategories: [],
                    description: "deprecated tool for creating React SPA using webpack as bundler",
                    authors: [],
                    softwareHelp: undefined,
                    softwareId: craSoftwareId,
                    sourceSlug: source.slug,
                    externalId: craSoftwareFormData.externalIdForSource,
                    isLibreSoftware: true,
                    keywords: [],
                    name: "create-react-app",
                    license: expect.stringMatching(/MIT/i),
                    image: undefined,
                    codeRepositoryUrl: "https://github.com/facebook/create-react-app",
                    url: "https://create-react-app.dev/",
                    programmingLanguages: [],
                    referencePublications: [],
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
                        },
                        {
                            "@type": "PropertyValue",
                            "additionalType": "Repo",
                            "subjectOf": {
                                "@type": "Website",
                                "additionalType": "GitHub",
                                "name": "GitHub is a proprietary developer platform that allows developers to create, store, manage, and share their code.",
                                "url": new URL("https://github.com/")
                            },
                            "url": "https://github.com/facebook/create-react-app",
                            "value": "https://github.com/facebook/create-react-app",
                            "valueReference": "63537249"
                        }
                    ],
                    latestVersion: { version: "5.0.1", releaseDate: expect.any(String) },
                    dateCreated: new Date("2022-04-12T00:00:00.000Z"),
                    lastDataFetchAt: expect.any(Date),
                    repoMetadata: undefined,
                    providers: [],
                    operatingSystems: undefined,
                    runtimePlatforms: undefined
                },
                {
                    applicationCategories: [],
                    description: {
                        "en": "open-source JavaScript module bundler",
                        "fr": "Outil frontend"
                    },
                    authors: [
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
                    softwareHelp: "https://ja.vitejs.dev/guide/",
                    sourceSlug: source.slug,
                    softwareId: undefined,
                    externalId: "Q111590996",
                    isLibreSoftware: true,
                    keywords: [],
                    name: "Vite",
                    license: expect.stringMatching(/MIT/i),
                    image: expect.stringContaining("Vite"),
                    codeRepositoryUrl: "https://github.com/vitejs/vite",
                    url: "https://vite.dev/",
                    programmingLanguages: ["JavaScript"],
                    referencePublications: [],
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
                        },
                        {
                            "@type": "PropertyValue",
                            "additionalType": "Repo",
                            "subjectOf": {
                                "@type": "Website",
                                "additionalType": "GitHub",
                                "name": "GitHub is a proprietary developer platform that allows developers to create, store, manage, and share their code.",
                                "url": new URL("https://github.com/")
                            },
                            "url": "https://github.com/vitejs/vite",
                            "value": "https://github.com/vitejs/vite",
                            "valueReference": "257485422"
                        }
                    ],
                    latestVersion: { version: expect.any(String), releaseDate: expect.any(String) },
                    dateCreated: expect.any(Date),
                    lastDataFetchAt: expect.any(Date),
                    repoMetadata: undefined,
                    providers: [],
                    operatingSystems: undefined,
                    runtimePlatforms: undefined
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
                    applicationCategories: [],
                    description: {
                        en: "open-source web server software",
                        fr: "serveur web sous licence libre"
                    },
                    authors: [
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
                    softwareHelp: undefined,
                    sourceSlug: source.slug,
                    softwareId: apacheSoftwareId,
                    externalId: "Q11354",
                    isLibreSoftware: false,
                    keywords: [],
                    name: "Apache HTTP Server",
                    license: "Apache License v2.0",
                    image: "//upload.wikimedia.org/wikipedia/commons/thumb/1/10/Apache_HTTP_server_logo_%282019-present%29.svg/250px-Apache_HTTP_server_logo_%282019-present%29.svg.png",
                    codeRepositoryUrl: "https://github.com/apache/httpd",
                    url: "https://httpd.apache.org/",
                    referencePublications: [],
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
                        },
                        {
                            "@type": "PropertyValue",
                            "additionalType": "Repo",
                            "subjectOf": {
                                "@type": "Website",
                                "additionalType": "GitHub",
                                "name": "GitHub is a proprietary developer platform that allows developers to create, store, manage, and share their code.",
                                "url": new URL("https://github.com/")
                            },
                            "url": "https://github.com/apache/httpd",
                            "value": "https://github.com/apache/httpd",
                            "valueReference": "205423"
                        }
                    ],
                    programmingLanguages: ["C"],
                    latestVersion: { version: "2.5.0-alpha", releaseDate: expect.any(String) },
                    dateCreated: new Date("2017-11-08T00:00:00.000Z"),
                    lastDataFetchAt: expect.any(Date),
                    repoMetadata: undefined,
                    providers: [],
                    operatingSystems: undefined,
                    runtimePlatforms: undefined
                },
                emptyExternalDataCleaned({
                    externalId: "Q118629387",
                    sourceSlug: "wikidata",
                    softwareId: 11
                }),
                emptyExternalDataCleaned({
                    externalId: "Q111590996",
                    sourceSlug: "wikidata",
                    name: viteOption.name,
                    description: viteOption.description,
                    isLibreSoftware: viteOption.isLibreSoftware
                })
            ]);
        },
        { timeout: 20_000 }
    );
});
