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
import { makeUpdateSoftware, UpdateSoftware } from "./updateSoftware";

const craSoftwareFormData = {
    softwareType: {
        type: "stack"
    },
    externalIdForSource: "Q118629387",
    sourceSlug: testSource.slug,
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

describe("Create software, than updates it adding a similar software", () => {
    let dbApi: DbApiV2;
    let db: Kysely<Database>;
    let craSoftwareId: number;
    let userId: number;
    let createSoftware: CreateSoftware;
    let updateSoftware: UpdateSoftware;

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
        updateSoftware = makeUpdateSoftware(dbApi);
    });

    it("should insert into three tables", async () => {
        craSoftwareId = await createSoftware({
            formData: craSoftwareFormData,
            userId
        });

        const softwareList = await db.selectFrom("softwares").selectAll().execute();

        expectToEqual(softwareList.length, 1);
        expectToMatchObject(softwareList[0], {
            "addedByUserId": userId,
            "categories": [],
            "dereferencing": null,
            "description": "To create React apps.",
            "doRespectRgaa": true,
            "generalInfoMd": null,
            "isFromFrenchPublicService": true,
            "isPresentInSupportContract": true,
            "isStillInObservation": false,
            "keywords": ["Productivity", "Task", "Management"],
            "license": "MIT",
            "logoUrl": "https://example.com/logo.png",
            "name": "Create react app",
            "referencedSinceTime": expect.any(String), // To format
            "softwareType": {
                "type": "stack"
            },
            "versionMin": "1.0.0",
            "workshopUrls": []
        });

        const initialExternalSoftwarePackagesBeforeFetching = [
            emptyExternalData({
                externalId: "Q118629387",
                sourceSlug: "wikidata",
                softwareId: craSoftwareId
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

        const similarSofts = await dbApi.software.getSimilarSoftwareExternalDataPks({ softwareId: craSoftwareId });
        expectToMatchObject(similarSofts, [
            { sourceSlug: testSource.slug, externalId: "Q111590996", softwareId: undefined }
        ]);

        // than update the software, adding a similar software:
        const formDataWithAnNewSimilarSoftware: SoftwareFormData = {
            ...craSoftwareFormData,
            similarSoftwareExternalDataIds: ["Q111590996" /* vite js */, "Q56062435" /* Next.js */]
        };
        await updateSoftware({
            formData: formDataWithAnNewSimilarSoftware,
            softwareId: craSoftwareId,
            userId
        });

        const updatedSoftwareList = await db.selectFrom("softwares").selectAll().execute();

        expectToEqual(updatedSoftwareList.length, 1);

        const updatedSimilarSofts = await dbApi.software.getSimilarSoftwareExternalDataPks({
            softwareId: craSoftwareId
        });
        expectToMatchObject(updatedSimilarSofts, [
            { sourceSlug: testSource.slug, externalId: "Q111590996", softwareId: undefined },
            { sourceSlug: testSource.slug, externalId: "Q56062435", softwareId: undefined }
        ]);

        // than update the software again, removing all similar software:
        const formDataWithNoSimilarSoftware: SoftwareFormData = {
            ...craSoftwareFormData,
            similarSoftwareExternalDataIds: []
        };
        await updateSoftware({
            formData: formDataWithNoSimilarSoftware,
            softwareId: craSoftwareId,
            userId
        });

        const finalSimilarSofts = await dbApi.software.getSimilarSoftwareExternalDataPks({
            softwareId: craSoftwareId
        });
        expectToMatchObject(finalSimilarSofts, []);
    });
});
