// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from "vitest";
import { SoftwareFormData } from "./readWriteSillData";
import { DbApiV2 } from "../ports/DbApiV2";
import { Kysely } from "kysely";
import { Database } from "../adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../adapters/dbApi/kysely/kysely.dialect";
import {
    emptyExternalData,
    expectToEqual,
    expectToMatchObject,
    resetDB,
    testPgUrl,
    testSource
} from "../../tools/test.helpers";
import { createKyselyPgDbApi } from "../adapters/dbApi/kysely/createPgDbApi";
import { CreateSoftware, makeCreateSofware } from "./createSoftware";
import { SoftwareExternalDataOption } from "../ports/GetSoftwareExternalDataOptions";

const viteOption: SoftwareExternalDataOption = {
    externalId: "Q111590996" /* viteJS */,
    sourceSlug: testSource.slug,
    label: "Vite JS",
    description: "Vite JS is a build tool for modern web development.",
    isLibreSoftware: true
};

const craSoftwareFormData = {
    softwareType: {
        type: "stack"
    },
    externalIdForSource: "Q118629387",
    sourceSlug: testSource.slug,
    softwareName: "Create react app",
    softwareDescription: "To create React apps.",
    softwareLicense: "MIT",
    similarSoftwareExternalDataItems: [viteOption],
    softwareLogoUrl: "https://example.com/logo.png",
    softwareKeywords: ["Productivity", "Task", "Management"],
    customAttributes: {
        doRespectRgaa: true,
        isPresentInSupportContract: true,
        isFromFrenchPublicService: true
    }
} satisfies SoftwareFormData;

describe("Create software - Trying all the cases", () => {
    let dbApi: DbApiV2;
    let db: Kysely<Database>;
    let craSoftwareId: number;
    let userId: number;
    let createSoftware: CreateSoftware;

    beforeEach(async () => {
        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        await resetDB(db);

        dbApi = createKyselyPgDbApi(db);

        userId = await dbApi.user.add({
            email: "myuser@example.com",
            organization: "myorg",
            about: "my about",
            isPublic: false,
            sub: null
        });

        createSoftware = makeCreateSofware(dbApi);
    });

    it("should insert into three tables", async () => {
        craSoftwareId = await createSoftware({
            formData: craSoftwareFormData,
            userId
        });

        const softwareListFromApi = await dbApi.software.getFullList();

        expectToEqual(softwareListFromApi.length, 1);

        const softwareListFromApiItem = await dbApi.software.getDetails(softwareListFromApi[0].id);
        expectToMatchObject(softwareListFromApiItem, {
            softwareName: "Create react app",
            similarSoftwares: [
                {
                    ...viteOption,
                    registered: false
                }
            ]
        });

        const softwareListFromDb = await db.selectFrom("softwares").selectAll().execute();

        expectToEqual(softwareListFromDb.length, 1);
        expectToMatchObject(softwareListFromDb[0], {
            "addedByUserId": userId,
            "categories": [],
            "dereferencing": null,
            "description": "To create React apps.",
            "generalInfoMd": null,
            "isStillInObservation": false,
            "keywords": ["Productivity", "Task", "Management"],
            "license": "MIT",
            "logoUrl": "https://example.com/logo.png",
            "name": "Create react app",
            "referencedSinceTime": expect.any(Date),
            "softwareType": {
                "type": "stack"
            },
            "workshopUrls": [],
            "customAttributes": {
                "isFromFrenchPublicService": true,
                "isPresentInSupportContract": true,
                "doRespectRgaa": true
            }
        });

        const initialExternalSoftwarePackagesBeforeFetching = [
            emptyExternalData({
                externalId: "Q118629387",
                sourceSlug: "wikidata",
                softwareId: craSoftwareId
            }),
            emptyExternalData({
                ...viteOption,
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

        const similarId = await dbApi.software.getSimilarSoftwareExternalDataPks({ softwareId: craSoftwareId });
        expectToMatchObject(similarId, [
            { sourceSlug: testSource.slug, externalId: "Q111590996", softwareId: undefined }
        ]);

        console.log(craSoftwareId);
    });

    it("Insert two software with the same name, should not duplicate the software", async () => {
        craSoftwareId = await createSoftware({
            formData: craSoftwareFormData,
            userId
        });

        craSoftwareId = await createSoftware({
            formData: craSoftwareFormData,
            userId
        });

        const softwareList = await db.selectFrom("softwares").selectAll().execute();
        expectToEqual(softwareList.length, 1);
    });

    it("Insert two software with the same name but different external Id, should create a new externalData linked with the saved software package", async () => {
        craSoftwareId = await createSoftware({
            formData: craSoftwareFormData,
            userId
        });

        craSoftwareId = await createSoftware({
            formData: {
                ...craSoftwareFormData,
                externalIdForSource: "Q118629388"
            },
            userId
        });

        const softwareList = await db.selectFrom("softwares").selectAll().execute();
        expectToEqual(softwareList.length, 1);

        const externdalDataList = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externdalDataList.length, 3);

        const externalIdForSoft = await dbApi.softwareExternalData.getBySoftwareId({ softwareId: craSoftwareId });
        expectToEqual(externalIdForSoft?.length, 2);
    });

    it("Insert a software when externalData is already saved with no related software, should not create another externalData and linked the existing one to the new software", async () => {
        await dbApi.softwareExternalData.saveMany([
            {
                sourceSlug: testSource.slug,
                externalId: "Q118629387"
            }
        ]);

        const externdalDataListBefore = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externdalDataListBefore.length, 1);

        craSoftwareId = await createSoftware({
            formData: craSoftwareFormData,
            userId
        });

        const softwareList = await db.selectFrom("softwares").selectAll().execute();
        expectToEqual(softwareList.length, 1);

        const externdalDataList = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externdalDataList.length, 2);

        const externalDataUpdated = await dbApi.softwareExternalData.getBySoftwareId({ softwareId: craSoftwareId });
        expectToEqual(externalDataUpdated?.length, 1);
        expectToEqual(externalDataUpdated?.[0].externalId, "Q118629387");
    });

    it("Insert a software when externalData is already saved with related software, should not create another software neither new externalData", async () => {
        craSoftwareId = await createSoftware({
            formData: craSoftwareFormData,
            userId
        });

        const externdalDataListBefore = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externdalDataListBefore.length, 2);

        const alteredNameForm = {
            ...craSoftwareFormData,
            softwareName: "Create react app 2"
        };

        craSoftwareId = await createSoftware({
            formData: alteredNameForm,
            userId
        });

        const softwareList = await db.selectFrom("softwares").selectAll().execute();
        expectToEqual(softwareList.length, 1);

        const externdalDataList = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externdalDataList.length, 2);

        const externalDataUpdated = await dbApi.softwareExternalData.getBySoftwareId({ softwareId: craSoftwareId });
        expectToEqual(externalDataUpdated?.length, 1);
        expectToEqual(externalDataUpdated?.[0].externalId, "Q118629387");
    });

    it("Insert a software when similarExternalData is already saved, should linked the existing externalData to the new software row", async () => {
        await dbApi.softwareExternalData.saveMany([
            {
                sourceSlug: testSource.slug,
                externalId: "Q111590996"
            }
        ]);

        const externdalDataListBefore = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externdalDataListBefore.length, 1);

        craSoftwareId = await createSoftware({
            formData: craSoftwareFormData,
            userId
        });

        const softwareList = await db.selectFrom("softwares").selectAll().execute();
        expectToEqual(softwareList.length, 1);

        const externdalDataList = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externdalDataList.length, 2);

        const externalDataUpdated = await dbApi.softwareExternalData.getBySoftwareId({ softwareId: craSoftwareId });
        expectToEqual(externalDataUpdated?.length, 1);
        expectToEqual(externalDataUpdated?.[0].externalId, "Q118629387");
    });

    it("Insert a software with multiples similarExternalData with one already existing, should create one and update the other one", async () => {
        await dbApi.softwareExternalData.saveMany([
            {
                sourceSlug: testSource.slug,
                externalId: "Q111590996"
            }
        ]);

        const externdalDataListBefore = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externdalDataListBefore.length, 1);

        craSoftwareId = await createSoftware({
            formData: {
                ...craSoftwareFormData,
                similarSoftwareExternalDataItems: [
                    {
                        externalId: "Q111590996",
                        sourceSlug: testSource.slug,
                        label: "Vite JS",
                        description: "Vite JS is a build tool for modern web development.",
                        isLibreSoftware: true
                    },
                    {
                        externalId: "Q111590997",
                        sourceSlug: testSource.slug,
                        label: "Vite JS 2",
                        description: "Vite JS 2 is a build tool for modern web development.",
                        isLibreSoftware: true
                    }
                ]
            },
            userId
        });

        const softwareList = await db.selectFrom("softwares").selectAll().execute();
        expectToEqual(softwareList.length, 1);

        const externalDataList = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externalDataList.length, 3);

        const similarExternalData = await dbApi.software.getSimilarSoftwareExternalDataPks({
            softwareId: craSoftwareId
        });
        expectToEqual(similarExternalData?.length, 2);

        craSoftwareId = await createSoftware({
            formData: {
                ...craSoftwareFormData,
                similarSoftwareExternalDataItems: [
                    {
                        externalId: "Q111590996",
                        sourceSlug: testSource.slug,
                        label: "Vite JS",
                        description: "Vite JS is a build tool for modern web development.",
                        isLibreSoftware: true
                    },
                    {
                        externalId: "Q111590998",
                        sourceSlug: testSource.slug,
                        label: "Vite JS 3",
                        description: "Vite JS 3 is a build tool for modern web development.",
                        isLibreSoftware: true
                    }
                ]
            },
            userId
        });

        const externalDataListUpdated = await db.selectFrom("software_external_datas").selectAll().execute();
        expectToEqual(externalDataListUpdated.length, 4);

        const similarExternalDataUpdated = await dbApi.software.getSimilarSoftwareExternalDataPks({
            softwareId: craSoftwareId
        });
        expectToEqual(similarExternalDataUpdated?.length, 2);
    });

    // TODO Another case : register
});
