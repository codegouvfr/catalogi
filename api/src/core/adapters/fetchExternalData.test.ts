// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely, sql } from "kysely";
import { describe, it, beforeEach, expect } from "vitest";
import { expectToEqual, expectToMatchObject, testPgUrl } from "../../tools/test.helpers";
import type { DbApiV2 } from "../ports/DbApiV2";
import { ExternalDataOrigin } from "../ports/GetSoftwareExternalData";
import type { SoftwareFormData, Source } from "../usecases/readWriteSillData";
import { comptoirDuLibreApi } from "./comptoirDuLibreApi";
import { createKyselyPgDbApi } from "./dbApi/kysely/createPgDbApi";
import type { Database } from "./dbApi/kysely/kysely.database";
import { createPgDialect } from "./dbApi/kysely/kysely.dialect";
import { makeFetchAndSaveSoftwareExtraData } from "./fetchExternalData";
import { getCnllPrestatairesSill } from "./getCnllPrestatairesSill";
import { getServiceProviders } from "./getServiceProviders";
import { getWikidataSoftware } from "./wikidata/getWikidataSoftware";

const craSoftwareFormData = {
    softwareType: {
        type: "stack"
    },
    externalIdForSource: "Q118629387",
    sourceSlug: "wikidata",
    comptoirDuLibreId: 1,
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
            externalIdForSource: "Q11354",
            sourceSlug: "wikidata",
            comptoirDuLibreId: 3737,
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
};

const acceleroId = 2;
const insertAcceleroWithCorrectId = async (db: Kysely<Database>, userId: number) => {
    await db
        .insertInto("softwares")
        .values({
            id: acceleroId,
            softwareType: JSON.stringify({ type: "stack" }),
            externalIdForSource: "Q2822666",
            sourceSlug: "wikidata",
            comptoirDuLibreId: 304,
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
    return acceleroId;
};

const source = {
    slug: "wikidata",
    priority: 1,
    url: "https://www.wikidata.org",
    description: null,
    kind: "wikidata"
} satisfies Source;

describe("fetches software extra data (from different providers)", () => {
    let fetchAndSaveSoftwareExtraData: Awaited<ReturnType<typeof makeFetchAndSaveSoftwareExtraData>>;
    let dbApi: DbApiV2;
    let db: Kysely<Database>;
    let craSoftwareId: number;

    beforeEach(async () => {
        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        await db.deleteFrom("compiled_softwares").execute();
        await db.deleteFrom("software_external_datas").execute();
        await db.deleteFrom("software_users").execute();
        await db.deleteFrom("software_referents").execute();
        await db.deleteFrom("softwares").execute();
        await db.deleteFrom("users").execute();
        await db.deleteFrom("sources").execute();

        await db
            .insertInto("sources")
            .values({
                ...source,
                kind: source.kind as ExternalDataOrigin
            })
            .execute();

        await sql`SELECT setval('softwares_id_seq', 11, false)`.execute(db);

        dbApi = createKyselyPgDbApi(db);

        const userId = await dbApi.user.add({
            email: "myuser@example.com",
            organization: "myorg",
            about: "my about",
            isPublic: false
        });

        craSoftwareId = await dbApi.software.create({
            formData: craSoftwareFormData,
            userId
        });

        await insertApacheWithCorrectId(db, userId);
        await insertAcceleroWithCorrectId(db, userId);

        fetchAndSaveSoftwareExtraData = await makeFetchAndSaveSoftwareExtraData({
            dbApi,
            getSoftwareExternalData: getWikidataSoftware,
            comptoirDuLibreApi,
            getCnllPrestatairesSill: getCnllPrestatairesSill,
            getServiceProviders: getServiceProviders,
            wikidataSource: source
        });
    });

    it("does nothing if the software is not found", async () => {
        const softwareExternalDatas = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(softwareExternalDatas, []);

        await fetchAndSaveSoftwareExtraData(404, {});

        const updatedSoftwareExternalDatas = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(updatedSoftwareExternalDatas, []);
    });

    it(
        "fetches correctly the logoUrl from comptoir du libre",
        async () => {
            const softwareExternalDatas = await db.selectFrom("software_external_datas").selectAll().execute();
            expectToEqual(softwareExternalDatas, []);

            await fetchAndSaveSoftwareExtraData(acceleroId, {});

            const results = await db.selectFrom("compiled_softwares").select("comptoirDuLibreSoftware").execute();
            expect(results).toHaveLength(1);
            expectToMatchObject(results[0]!.comptoirDuLibreSoftware, {
                name: "Acceleo",
                logoUrl: "https://comptoir-du-libre.org//img/files/Softwares/Acceleo/avatar/Acceleo.png"
            });
        },
        { timeout: 10_000 }
    );

    it(
        "gets software external data and saves it, and does not save other extra data if there is nothing relevant",
        async () => {
            const softwareExternalDatas = await db.selectFrom("software_external_datas").selectAll().execute();
            expect(softwareExternalDatas).toHaveLength(0);

            const source = await db
                .selectFrom("sources")
                .selectAll()
                .orderBy("priority", "desc")
                .executeTakeFirstOrThrow();
            if (!source) throw new Error("Source not found");

            const { lastExtraDataFetchAt: initialLastExtraDataFetchAt } = await db
                .selectFrom("softwares")
                .select("lastExtraDataFetchAt")
                .where("id", "=", craSoftwareId)
                .executeTakeFirstOrThrow();

            expect(initialLastExtraDataFetchAt).toBe(null);

            await fetchAndSaveSoftwareExtraData(craSoftwareId, {});

            const updatedSoftwareExternalDatas = await db.selectFrom("software_external_datas").selectAll().execute();
            expectToEqual(updatedSoftwareExternalDatas, [
                {
                    applicationCategories: null,
                    description: "deprecated tool for creating React SPA using webpack as bundler",
                    developers: [],
                    documentationUrl: null,
                    softwareId: craSoftwareId,
                    sourceSlug: source.slug,
                    externalId: craSoftwareFormData.externalIdForSource,
                    isLibreSoftware: true,
                    keywords: [],
                    label: "create-react-app",
                    license: "MIT licence",
                    logoUrl: null,
                    sourceUrl: "https://github.com/facebook/create-react-app",
                    websiteUrl: "https://create-react-app.dev/",
                    programmingLanguages: [],
                    referencePublications: null,
                    identifiers: [],
                    softwareVersion: "5.0.1",
                    publicationTime: new Date("2022-04-12T00:00:00.000Z")
                },
                {
                    applicationCategories: null,
                    description: "open-source JavaScript module bundler",
                    developers: [
                        {
                            "@type": "Person",
                            identifier: "Q58482636",
                            name: "Evan You",
                            url: `https://www.wikidata.org/wiki/Q58482636`
                        }
                    ],
                    documentationUrl: "https://ja.vitejs.dev/guide/",
                    sourceSlug: source.slug,
                    softwareId: null,
                    externalId: "Q111590996",
                    isLibreSoftware: true,

                    keywords: [],
                    label: "Vite",
                    license: "MIT licence",
                    logoUrl:
                        "//upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Vitejs-logo.svg/250px-Vitejs-logo.svg.png",
                    sourceUrl: "https://github.com/vitejs/vite",
                    websiteUrl: "https://vite.dev/",
                    programmingLanguages: ["JavaScript"],
                    referencePublications: null,
                    identifiers: [],
                    softwareVersion: expect.any(String),
                    publicationTime: expect.any(Date)
                }
            ]);

            const otherExtraData = await db.selectFrom("compiled_softwares").selectAll().execute();
            expectToEqual(otherExtraData, []);

            const { lastExtraDataFetchAt } = await db
                .selectFrom("softwares")
                .select("lastExtraDataFetchAt")
                .where("id", "=", craSoftwareId)
                .executeTakeFirstOrThrow();
            expect(lastExtraDataFetchAt).toBeTruthy();
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

            const softwareExternalDatas = await db.selectFrom("software_external_datas").selectAll().execute();
            expect(softwareExternalDatas).toHaveLength(0);

            await fetchAndSaveSoftwareExtraData(apacheSoftwareId, {});

            const updatedSoftwareExternalDatas = await db.selectFrom("software_external_datas").selectAll().execute();
            expectToEqual(updatedSoftwareExternalDatas, [
                {
                    applicationCategories: null,
                    description: {
                        en: "open-source web server software",
                        fr: "serveur web sous licence libre"
                    },
                    developers: [
                        {
                            "@type": "Organization",
                            identifier: "Q489709",
                            name: "Apache Software Foundation",
                            url: "https://www.wikidata.org/wiki/Q489709"
                        }
                    ],
                    documentationUrl: null,
                    sourceSlug: source.slug,
                    softwareId: apacheSoftwareId,
                    externalId: "Q11354",
                    isLibreSoftware: false,
                    keywords: [],
                    label: "Apache HTTP Server",
                    license: "Apache License v2.0",
                    logoUrl:
                        "//upload.wikimedia.org/wikipedia/commons/thumb/1/10/Apache_HTTP_server_logo_%282019-present%29.svg/250px-Apache_HTTP_server_logo_%282019-present%29.svg.png",
                    sourceUrl: "https://github.com/apache/httpd",
                    websiteUrl: "https://httpd.apache.org/",
                    referencePublications: null,
                    identifiers: [],
                    programmingLanguages: ["C"],
                    softwareVersion: "2.5.0-alpha",
                    publicationTime: new Date("2017-11-08T00:00:00.000Z")
                }
            ]);

            const otherExtraData = await db.selectFrom("compiled_softwares").selectAll().execute();

            expectToEqual(otherExtraData, [
                {
                    softwareId: apacheSoftwareId,
                    comptoirDuLibreSoftware: null,
                    annuaireCnllServiceProviders: [
                        {
                            url: "https://annuaire.cnll.fr/societes/538420753",
                            name: "INNO3",
                            siren: "538420753"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/522588979",
                            name: "COMBODO",
                            siren: "522588979"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/452887441",
                            name: "APITUX",
                            siren: "452887441"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/820266211",
                            name: "POLLEN ROBOTICS",
                            siren: "820266211"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/483494589",
                            name: "CENTREON",
                            siren: "483494589"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/524457520",
                            name: "Lan2Net",
                            siren: "524457520"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/824429708",
                            name: "WORTEKS",
                            siren: "824429708"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/499277713",
                            name: "PLICIWEB SOLUTIONS",
                            siren: "499277713"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/450656731",
                            name: "Ryxéo",
                            siren: "450656731"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/813965662",
                            name: "DEBAMAX",
                            siren: "813965662"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/495075079",
                            name: "Telnowedge",
                            siren: "495075079"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/449989573",
                            name: "WebGeoDataVore",
                            siren: "449989573"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/443170139",
                            name: "Entr'ouvert",
                            siren: "443170139"
                        },
                        {
                            url: "https://annuaire.cnll.fr/societes/451952295",
                            name: "EVOLIX",
                            siren: "451952295"
                        }
                    ],
                    serviceProviders: [
                        {
                            name: "Oziolab",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/4075",
                            website: "https://www.oziolab.fr"
                        },
                        {
                            name: "Lan2Net",
                            siren: "524457520",
                            cnllUrl: "https://annuaire.cnll.fr/societes/524457520",
                            website: "https://www.lan2net.fr/",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/4116"
                        },
                        {
                            name: "DEBAMAX",
                            siren: "813965662",
                            cnllUrl: "https://annuaire.cnll.fr/societes/813965662"
                        },
                        {
                            "cdlUrl": "https://comptoir-du-libre.org/fr/users/2225",
                            "name": "Boscop",
                            "website": "https://www.boscop.fr"
                        },
                        {
                            name: "INNO3",
                            siren: "538420753",
                            cnllUrl: "https://annuaire.cnll.fr/societes/538420753"
                        },
                        {
                            name: "WebGeoDataVore",
                            siren: "449989573",
                            cnllUrl: "https://annuaire.cnll.fr/societes/449989573"
                        },
                        {
                            name: "PLICIWEB SOLUTIONS",
                            siren: "499277713",
                            cnllUrl: "https://annuaire.cnll.fr/societes/499277713"
                        },
                        {
                            name: "Probesys",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/398",
                            website: "https://www.probesys.com"
                        },
                        {
                            name: "Ionzee",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/3681",
                            website: ""
                        },
                        {
                            name: "APITUX",
                            siren: "452887441",
                            cnllUrl: "https://annuaire.cnll.fr/societes/452887441"
                        },
                        {
                            name: "CENTREON",
                            siren: "483494589",
                            cnllUrl: "https://annuaire.cnll.fr/societes/483494589"
                        },
                        {
                            name: "Bearstech",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/3960",
                            website: "https://bearstech.com"
                        },
                        {
                            name: "CIGALL",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/270",
                            website: "Https://www.cigall.fr"
                        },
                        {
                            name: "Azure Informatique",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/3962",
                            website: ""
                        },
                        {
                            name: "Your Own Net",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/162",
                            website: "https://yourownnet.net"
                        },
                        {
                            name: "EDISSYUM Consulting",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/345",
                            website: "http://www.edissyum.com"
                        },
                        {
                            name: "EVOLIX",
                            siren: "451952295",
                            cnllUrl: "https://annuaire.cnll.fr/societes/451952295"
                        },
                        {
                            name: "Talan",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/4021",
                            website: "https://talan.com"
                        },
                        {
                            name: "Microlinux",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/295",
                            website: "https://www.microlinux.fr"
                        },
                        {
                            name: "decaris",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/643",
                            website: "https://mywebdatahome.com"
                        },
                        {
                            name: "SIGMAZ Consilium",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/3893",
                            website: "https://sigmaz-consilium.fr/"
                        },
                        {
                            name: "Ryxéo",
                            siren: "450656731",
                            cnllUrl: "https://annuaire.cnll.fr/societes/450656731"
                        },
                        {
                            name: "Telnowedge",
                            siren: "495075079",
                            cnllUrl: "https://annuaire.cnll.fr/societes/495075079"
                        },
                        {
                            name: "APLOSE",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/165",
                            website: "https://www.aplose.fr"
                        },
                        {
                            "cdlUrl": "https://comptoir-du-libre.org/fr/users/4129",
                            "name": "Keenobi",
                            "website": "https://keenobi.com/"
                        },
                        {
                            name: "TEICEE",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/3838",
                            website: "https://www.teicee.com"
                        },
                        {
                            name: "CAP-REL",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/3216",
                            website: "https://cap-rel.fr"
                        },
                        {
                            name: "Entr'ouvert",
                            siren: "443170139",
                            cnllUrl: "https://annuaire.cnll.fr/societes/443170139"
                        },
                        {
                            name: "COMBODO",
                            siren: "522588979",
                            cnllUrl: "https://annuaire.cnll.fr/societes/522588979"
                        },
                        {
                            name: "3CT - Consulting and Conception of Cloud Technologies",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/4085",
                            website: "https://www.3ct.fr"
                        },

                        {
                            name: "AUKFOOD",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/3288",
                            website: "https://www.aukfood.fr"
                        },
                        {
                            name: "POLLEN ROBOTICS",
                            siren: "820266211",
                            cnllUrl: "https://annuaire.cnll.fr/societes/820266211"
                        },
                        {
                            name: "WORTEKS",
                            siren: "824429708",
                            cdlUrl: "https://comptoir-du-libre.org/fr/users/255",
                            cnllUrl: "https://annuaire.cnll.fr/societes/824429708",
                            website: "https://www.worteks.com/"
                        }
                    ],
                    latestVersion: null
                }
            ]);
        },
        { timeout: 20_000 }
    );
});
