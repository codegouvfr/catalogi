// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { beforeAll, describe, expect, it } from "vitest";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { stripNullOrUndefinedValues } from "../core/adapters/dbApi/kysely/kysely.utils";
import type { DbUser } from "../core/ports/DbApiV2";
import type { InstanceFormData, Source } from "../core/usecases/readWriteSillData";
import {
    createDeclarationFormData,
    createInstanceFormData,
    createSoftwareFormData,
    expectToEqual,
    expectToMatchObject,
    testPgUrl
} from "../tools/test.helpers";
import { ApiCaller, createTestCaller, defaultUser } from "./createTestCaller";

const mainSource = {
    slug: "wikidata",
    priority: 1,
    url: "https://www.wikidata.org",
    description: null,
    kind: "wikidata"
} satisfies Source;
const softwareFormData = createSoftwareFormData({ sourceSlug: mainSource.slug });
const declarationFormData = createDeclarationFormData();

describe("RPC e2e tests", () => {
    let apiCaller: ApiCaller;
    let kyselyDb: Kysely<Database>;

    describe("stripNullOrUndefined", () => {
        it("removes null and undefined values", () => {
            const stripped = stripNullOrUndefinedValues({
                "a": null,
                "b": undefined,
                "c": 0,
                "d": 1,
                "e": "",
                "f": "yolo"
            });
            expect(stripped.hasOwnProperty("a")).toBe(false);
            expect(stripped.hasOwnProperty("b")).toBe(false);
            expect(stripped).toStrictEqual({ "c": 0, "d": 1, "e": "", "f": "yolo" });
        });
    });

    describe("getAgents - wrong paths", () => {
        it("fails with UNAUTHORIZED if user is not logged in", async () => {
            ({ apiCaller, kyselyDb } = await createTestCaller({ currentUser: undefined }));
            await expect(apiCaller.getUsers()).rejects.toThrow("UNAUTHORIZED");
        });
    });

    describe("createUserOrReferent - Wrong paths", () => {
        it("fails with UNAUTHORIZED if user is not logged in", async () => {
            ({ apiCaller, kyselyDb } = await createTestCaller({ currentUser: undefined }));
            await expect(
                apiCaller.createUserOrReferent({
                    formData: declarationFormData,
                    softwareId: 123
                })
            ).rejects.toThrow("UNAUTHORIZED");
        });

        it("fails when software is not found", async () => {
            ({ apiCaller, kyselyDb } = await createTestCaller());
            await expect(
                apiCaller.createUserOrReferent({
                    formData: declarationFormData,
                    softwareId: 404
                })
            ).rejects.toThrow("Software not found");
        });
    });

    describe("createSoftware - Wrong paths", () => {
        it("fails with UNAUTHORIZED if user is not logged in", async () => {
            ({ apiCaller, kyselyDb } = await createTestCaller({ currentUser: undefined }));
            await expect(
                apiCaller.createSoftware({
                    formData: softwareFormData
                })
            ).rejects.toThrow("UNAUTHORIZED");
        });
    });

    // ⚠️ reminder : you need to run the whole scenarios
    // because those tests are not isolated
    // (the order is important)⚠️
    describe("Scenario - Add a new software then mark an agent as user of this software", () => {
        let actualSoftwareId: number;
        let instanceFormData: InstanceFormData;
        let user: DbUser;

        beforeAll(async () => {
            kyselyDb = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
            await kyselyDb.deleteFrom("software_referents").execute();
            await kyselyDb.deleteFrom("software_users").execute();
            await kyselyDb.deleteFrom("instances").execute();
            await kyselyDb.deleteFrom("software_external_datas").execute();
            await kyselyDb.deleteFrom("softwares").execute();
            await kyselyDb.deleteFrom("users").execute();
            await kyselyDb.deleteFrom("sources").execute();

            await kyselyDb.insertInto("sources").values(mainSource).executeTakeFirst();

            ({ apiCaller, kyselyDb } = await createTestCaller({ db: kyselyDb, currentUser: defaultUser }));
        });

        it("gets the list of users, which is initially empty", async () => {
            const { users } = await apiCaller.getUsers();
            expect(users).toHaveLength(1);
        });

        it("adds a new software", async () => {
            expect(await getSoftwareRows()).toHaveLength(0);
            const initialSoftwares = await apiCaller.getSoftwares();
            expectToEqual(initialSoftwares, []);

            await apiCaller.createSoftware({
                formData: softwareFormData
            });

            const { users } = await apiCaller.getUsers();
            expect(users).toHaveLength(1);
            user = users[0];
            expectToMatchObject(user, {
                id: expect.any(Number),
                email: defaultUser.email,
                organization: defaultUser.organization
            });

            const softwareRows = await getSoftwareRows();
            expect(softwareRows).toHaveLength(1);

            actualSoftwareId = softwareRows[0].id;

            expectToMatchObject(softwareRows[0], {
                "description": softwareFormData.softwareDescription,
                "externalIdForSource": softwareFormData.externalIdForSource,
                "doRespectRgaa": softwareFormData.doRespectRgaa ?? undefined,
                "isFromFrenchPublicService": softwareFormData.isFromFrenchPublicService,
                "isPresentInSupportContract": softwareFormData.isPresentInSupportContract,
                "keywords": softwareFormData.softwareKeywords,
                "license": softwareFormData.softwareLicense,
                "logoUrl": softwareFormData.softwareLogoUrl,
                "name": softwareFormData.softwareName,
                "softwareType": softwareFormData.softwareType,
                "versionMin": softwareFormData.softwareMinimalVersion ?? undefined,
                "workshopUrls": [],
                "categories": [],
                "isStillInObservation": false,
                "id": expect.any(Number),
                "addedByUserId": user.id
            });

            const similarSoftsInDb = await kyselyDb
                .selectFrom("softwares__similar_software_external_datas")
                .selectAll()
                .execute();

            expect(similarSoftsInDb).toHaveLength(softwareFormData.similarSoftwareExternalDataIds.length);
            softwareFormData.similarSoftwareExternalDataIds.forEach(similarExternalId => {
                expectToMatchObject(similarSoftsInDb[0], {
                    softwareId: actualSoftwareId,
                    similarExternalId
                });
            });
        });

        it("gets the list of users, which now has the user which added the software", async () => {
            const { users } = await apiCaller.getUsers();
            expect(users).toHaveLength(1);
            expectToMatchObject(users[0], {
                "email": defaultUser.email,
                "organization": defaultUser.organization
            });
        });

        it("gets the new software in the list", async () => {
            const softwares = await apiCaller.getSoftwares();
            expect(softwares).toHaveLength(1);
            expectToMatchObject(softwares[0], { softwareName: softwareFormData.softwareName });
        });

        it("adds a user as user of the software", async () => {
            expect(await getUserRows()).toHaveLength(1);
            expect(await getSoftwareRows()).toHaveLength(1);
            expect(await getSoftwareUserRows()).toHaveLength(0);

            await apiCaller.createUserOrReferent({
                formData: declarationFormData,
                softwareId: actualSoftwareId
            });

            if (declarationFormData.declarationType !== "user")
                throw new Error("This test is only for user declaration");

            const softwareUserRows = await getSoftwareUserRows();
            expect(softwareUserRows).toHaveLength(1);

            expectToEqual(softwareUserRows[0], {
                "userId": expect.any(Number),
                "softwareId": expect.any(Number),
                "os": declarationFormData.os ?? null,
                "serviceUrl": declarationFormData.serviceUrl ?? null,
                "useCaseDescription": declarationFormData.usecaseDescription,
                "version": declarationFormData.version
            });
        });

        it("adds an instance of the software", async () => {
            instanceFormData = createInstanceFormData({ mainSoftwareSillId: actualSoftwareId });
            expect(await getSoftwareRows()).toHaveLength(1);
            expect(await getInstanceRows()).toHaveLength(0);
            await apiCaller.createInstance({
                formData: instanceFormData
            });
            const instanceRows = await getInstanceRows();
            expect(instanceRows).toHaveLength(1);
            expectToMatchObject(instanceRows[0], {
                "id": expect.any(Number),
                "addedByUserId": user.id,
                "mainSoftwareSillId": actualSoftwareId,
                "organization": instanceFormData.organization,
                "instanceUrl": instanceFormData.instanceUrl,
                "isPublic": instanceFormData.isPublic,
                "targetAudience": instanceFormData.targetAudience
            });
        });

        it("gets the new instances in the list", async () => {
            const instances = await apiCaller.getInstances();
            expect(instances).toHaveLength(1);
            expectToMatchObject(instances[0], {
                "id": expect.any(Number),
                "mainSoftwareSillId": actualSoftwareId,
                "organization": instanceFormData.organization,
                "instanceUrl": instanceFormData.instanceUrl,
                "isPublic": instanceFormData.isPublic,
                "targetAudience": instanceFormData.targetAudience
            });
        });
    });

    const getSoftwareRows = async () => kyselyDb.selectFrom("softwares").selectAll().execute();
    const getUserRows = () => kyselyDb.selectFrom("users").selectAll().execute();
    const getSoftwareUserRows = () => kyselyDb.selectFrom("software_users").selectAll().execute();
    const getInstanceRows = () => kyselyDb.selectFrom("instances").selectAll().execute();
});
