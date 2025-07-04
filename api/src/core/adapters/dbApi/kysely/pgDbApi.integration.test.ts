// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Kysely } from "kysely";
import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { expectPromiseToFailWith, expectToEqual, testPgUrl } from "../../../../tools/test.helpers";
import { DbUser, DbApiV2 } from "../../../ports/DbApiV2";
import { ExternalDataOrigin, SoftwareExternalData } from "../../../ports/GetSoftwareExternalData";
import { DeclarationFormData, SoftwareFormData, Source } from "../../../usecases/readWriteSillData";
import { createKyselyPgDbApi } from "./createPgDbApi";
import { Database } from "./kysely.database";
import { createPgDialect } from "./kysely.dialect";
// import * as fs from "node:fs";
// import { compiledDataPrivateToPublic } from "../../../ports/CompileData";

const externalIdForSource = "external-id-111";
const source = {
    slug: "wikidata",
    priority: 1,
    url: "https://www.wikidata.org",
    description: null,
    kind: "wikidata"
} satisfies Source;
const similarExternalId = "external-id-222";
const softwareFormData: SoftwareFormData = {
    comptoirDuLibreId: 50,
    doRespectRgaa: true,
    externalIdForSource,
    sourceSlug: source.slug,
    isFromFrenchPublicService: false,
    isPresentInSupportContract: true,
    similarSoftwareExternalDataIds: [similarExternalId],
    softwareDescription: "Super software",
    softwareKeywords: ["bob", "l'éponge"],
    softwareLicense: "MIT",
    softwareLogoUrl: "https://soft-logo-url.com/logo.png",
    softwareMinimalVersion: "",
    softwareName: "",
    softwareType: {
        type: "desktop/mobile",
        os: {
            ios: true,
            android: true,
            mac: true,
            linux: false,
            windows: true
        }
    }
};

const softwareExternalData: SoftwareExternalData = {
    externalId: externalIdForSource,
    sourceSlug: source.slug,
    developers: [{ "@type": "Person", name: "Bob", identifier: "bob", url: `https://www.wikidata.org/wiki/bob` }],
    label: { en: "Some software" },
    description: { en: "Some software description" },
    isLibreSoftware: true,
    logoUrl: "https://external-software-logo-url.com/logo.png",
    websiteUrl: "https://example.com",
    sourceUrl: "https://example.com/source",
    documentationUrl: "https://example.com/documentation",
    license: "MIT",
    softwareVersion: "1.0.0",
    keywords: ["Usefull", "Daily"],
    programmingLanguages: ["C++"],
    applicationCategories: ["Software Cat I", "Software Cat II"],
    referencePublications: undefined,
    identifiers: undefined,
    publicationTime: new Date(1561566581000)
};

const similarSoftwareExternalData: SoftwareExternalData = {
    externalId: similarExternalId,
    sourceSlug: source.slug,
    developers: [
        {
            "@type": "Person",
            name: "Bobby",
            identifier: "similar-bob",
            url: `https://www.wikidata.org/wiki/similar-bob`
        }
    ],
    label: "Some similar software",
    description: { en: "Some similar software description" },
    isLibreSoftware: true,
    logoUrl: "https://similar-software-logo-url.com/similar-logo.png",
    websiteUrl: "https://example.similar.com",
    sourceUrl: "https://example.similar.com/source",
    documentationUrl: "https://example.similar.com/documentation",
    license: "MIT",
    softwareVersion: "3.0.2",
    keywords: ["Infra", "Adminsys"],
    programmingLanguages: ["Python3"],
    applicationCategories: ["Software Cat I", "Software Cat II"],
    referencePublications: undefined,
    identifiers: undefined,
    publicationTime: new Date(1561566581000)
};

const insertedUser = {
    email: "test@test.com",
    organization: "test-organization",
    isPublic: true,
    about: "test about",
    sub: null
};

const db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });

describe("pgDbApi", () => {
    let dbApi: DbApiV2;

    beforeEach(async () => {
        dbApi = createKyselyPgDbApi(db);
        await db.deleteFrom("software_referents").execute();
        await db.deleteFrom("software_users").execute();
        await db.deleteFrom("software_external_datas").execute();
        await db.deleteFrom("softwares").execute();
        await db.deleteFrom("instances").execute();
        await db.deleteFrom("users").execute();
        await db.deleteFrom("sources").execute();

        await db
            .insertInto("sources")
            .values({
                ...source,
                kind: source.kind as ExternalDataOrigin
            })
            .execute();
    });

    afterEach(() => {
        console.log("------  END OF TEST ------");
    });

    describe("getCompiledDataPrivate", () => {
        it("gets private compiled data", async () => {
            // const compiledDataPrivate = await dbApi.getCompiledDataPrivate();
            // console.log("compiledDataPrivate.length : ", compiledDataPrivate.length);
            // // write softwares to file
            // const publicCompiledData = compiledDataPrivateToPublic(compiledDataPrivate);
            // publicCompiledData.sort((a, b) => (a.id >= b.id ? 1 : -1));
            // const data = JSON.stringify(publicCompiledData, null, 2);
            // fs.writeFileSync("./my-ordered-from-db.json", data);
            //
            // console.log("publicCompiledData", JSON.stringify(publicCompiledData, null, 2));
            //
            // expect(compiledDataPrivate.length > 0).toBe(true);
            // const { users, referents, instances, ...firstSoftware } = compiledDataPrivate.find(s => s.id === 42)!;
            // console.log(firstSoftware);
            // //
            // console.log(`Users n = ${users?.length} : `, users);
            // console.log(`Referents n = ${referents?.length} : `, referents);
            // console.log(`Instances n = ${instances?.length} : `, instances);
            // expect(compiledDataPrivate).toHaveLength(100);
        });
    });

    describe("software", () => {
        it("creates a software, than gets it with getAll, than updates adding a parent", async () => {
            console.log("------ software scenario ------");
            const { softwareId, userId } = await insertSoftwareExternalDataAndSoftwareAndUser();

            await dbApi.softwareUser.add({
                userId,
                softwareId,
                useCaseDescription: "des trucs de user",
                os: "windows",
                version: "1.0.0",
                serviceUrl: "https://example.com"
            });

            const softwares = await dbApi.software.getAll({ onlyIfUpdatedMoreThan3HoursAgo: true });

            const actualSoftware = softwares[0];

            expectToEqual(actualSoftware, {
                addedTime: expect.any(Number),
                updateTime: expect.any(Number),
                annuaireCnllServiceProviders: undefined,
                applicationCategories: ["Software Cat I", "Software Cat II"],
                authors: softwareExternalData.developers.map(dev => ({
                    "@type": "Person" as const,
                    name: dev.name,
                    url: `https://www.wikidata.org/wiki/${dev.identifier}`
                })),
                codeRepositoryUrl: softwareExternalData.sourceUrl,
                comptoirDuLibreId: 50,
                comptoirDuLibreServiceProviderCount: 0,
                dereferencing: undefined,
                documentationUrl: softwareExternalData.documentationUrl,
                sourceSlug: source.slug,
                externalId: externalIdForSource,
                keywords: ["bob", "l'éponge"],
                latestVersion: {
                    "publicationTime": 1561566581000,
                    "semVer": "1.0.0"
                },
                license: "MIT",
                logoUrl: softwareFormData.softwareLogoUrl,
                officialWebsiteUrl: softwareExternalData.websiteUrl,
                prerogatives: {
                    doRespectRgaa: true,
                    isFromFrenchPublicServices: false,
                    isPresentInSupportContract: true
                },
                programmingLanguages: ["C++"],
                serviceProviders: [],
                similarSoftwares: [
                    {
                        sourceSlug: source.slug,
                        externalId: similarSoftwareExternalData.externalId,
                        label: similarSoftwareExternalData.label,
                        description: similarSoftwareExternalData.description,
                        isLibreSoftware: similarSoftwareExternalData.isLibreSoftware,
                        isInSill: false
                    }
                ],
                softwareDescription: "Super software",
                softwareId: expect.any(Number),
                softwareName: softwareFormData.softwareName,
                softwareType: {
                    os: {
                        android: true,
                        ios: true,
                        linux: false,
                        mac: true,
                        windows: true
                    },
                    type: "desktop/mobile"
                },
                userAndReferentCountByOrganization: {
                    [insertedUser.organization]: {
                        userCount: 1,
                        referentCount: 0
                    }
                },
                versionMin: ""
            });

            console.log("getting all sill software external ids");
            const softwareExternalIds = await dbApi.software.getAllSillSoftwareExternalIds("wikidata");
            expectToEqual(softwareExternalIds, [externalIdForSource]);
        });
    });

    describe("instance", () => {
        it("creates an instance, than gets it with getAll", async () => {
            console.log("------ instance scenario ------");
            const { userId } = await insertSoftwareExternalDataAndSoftwareAndUser();
            const softwares = await dbApi.software.getAll();
            const softwareId = softwares[0].softwareId;
            console.log("saving instance");
            await dbApi.instance.create({
                userId,
                formData: {
                    mainSoftwareSillId: softwareId,
                    organization: "test-orga",
                    targetAudience: "test-audience",
                    instanceUrl: "https://example.com",
                    isPublic: true
                }
            });

            console.log("getting instance");
            const instances = await dbApi.instance.getAll();

            expectToEqual(instances[0], {
                id: expect.any(Number),
                mainSoftwareSillId: softwareId,
                organization: "test-orga",
                targetAudience: "test-audience",
                instanceUrl: "https://example.com",
                isPublic: true
            });
        });
    });

    describe("users", () => {
        it("adds a user, get it by email, updates it, getAll", async () => {
            console.log("------ user scenario------");
            console.log("inserting user");
            const userId = await dbApi.user.add(insertedUser);
            const softwareId = await dbApi.software.create({
                formData: softwareFormData,
                userId
            });

            await db
                .insertInto("software_users")
                .values({
                    userId,
                    softwareId,
                    os: "mac",
                    useCaseDescription: "des trucs de user",
                    version: "1",
                    serviceUrl: "https://example.com"
                })
                .execute();

            await db
                .insertInto("software_referents")
                .values({ userId, softwareId, useCaseDescription: "des trucs de référent", isExpert: true })
                .execute();

            console.log("getting user by email");
            const user = await dbApi.user.getByEmail(insertedUser.email);
            const expectedDeclarations: (DeclarationFormData & { softwareName: string })[] = [
                {
                    declarationType: "user",
                    softwareName: softwareFormData.softwareName,
                    os: "mac",
                    version: "1",
                    serviceUrl: "https://example.com",
                    usecaseDescription: "des trucs de user"
                },
                {
                    declarationType: "referent",
                    softwareName: softwareFormData.softwareName,
                    isTechnicalExpert: true,
                    usecaseDescription: "des trucs de référent",
                    serviceUrl: undefined
                }
            ];

            expectToEqual(user, {
                id: expect.any(Number),
                email: insertedUser.email,
                organization: insertedUser.organization,
                about: insertedUser.about,
                isPublic: insertedUser.isPublic,
                declarations: expectedDeclarations,
                sub: null
            });

            const updatedUser: DbUser = {
                id: user!.id,
                organization: "updated-test-organization",
                about: "updated about",
                email: "updated@test.com",
                isPublic: !insertedUser.isPublic,
                sub: null
            };

            console.log("updating user");
            await dbApi.user.update(updatedUser);

            console.log("getting all users");
            const allUsers = await dbApi.user.getAll();
            expectToEqual(allUsers, [{ ...updatedUser, declarations: expectedDeclarations }]);

            await db.deleteFrom("softwares").where("addedByUserId", "=", updatedUser.id).execute();

            console.log("removing user");
            await dbApi.user.remove(updatedUser.id);

            console.log("getting all users after delete");
            const allUsersAfterDelete = await dbApi.user.getAll();
            expectToEqual(allUsersAfterDelete, []);
        });
    });

    describe("users and referents", () => {
        let softwareId: number;
        let userId: number;
        beforeEach(async () => {
            console.log("before -- setting up test with software and user");
            await insertSoftwareExternalDataAndSoftwareAndUser();

            softwareId = (await dbApi.software.getAll())[0].softwareId;
            userId = (await dbApi.user.getAll())[0].id;
        });

        it("cannot add a user or referent if the software or user is missing in db", async () => {
            console.log("------ wrong path for user or referent ------");
            await expectPromiseToFailWith(
                dbApi.softwareReferent.add({
                    userId,
                    softwareId: 404,
                    isExpert: true,
                    serviceUrl: "https://example.com",
                    useCaseDescription: "my use case description"
                }),
                'insert or update on table "software_referents" violates foreign key constraint "software_referents_softwareId_fkey"'
            );

            await expectPromiseToFailWith(
                dbApi.softwareUser.add({
                    userId: 404,
                    softwareId,
                    serviceUrl: "https://example.com",
                    useCaseDescription: "my use case description",
                    os: "windows",
                    version: "1.0.0"
                }),
                'insert or update on table "software_users" violates foreign key constraint "software_users_agentId_fkey"'
            );
        });

        it("adds the user or referent correctly, than removes them", async () => {
            console.log("------ user or referent scenario ------");
            const user = {
                userId,
                softwareId,
                serviceUrl: "https://example.com",
                useCaseDescription: "my use case description",
                os: "windows" as const,
                version: "1.0.0"
            };
            await dbApi.softwareUser.add(user);

            const referent = {
                userId,
                softwareId,
                serviceUrl: "https://example.com",
                useCaseDescription: "my use case description",
                isExpert: true
            };
            await dbApi.softwareReferent.add(referent);

            const users = await db.selectFrom("software_users").selectAll().execute();
            const referents = await db.selectFrom("software_referents").selectAll().execute();

            expectToEqual(referents, [referent]);
            expectToEqual(users, [user]);

            await dbApi.softwareUser.remove({ softwareId, userId });
            const usersAfterDelete = await db.selectFrom("software_users").selectAll().execute();
            expectToEqual(usersAfterDelete, []);

            await dbApi.softwareReferent.remove({ softwareId, userId });
            const referentsAfterDelete = await db.selectFrom("software_referents").selectAll().execute();
            expectToEqual(referentsAfterDelete, []);
        });
    });

    const insertSoftwareExternalDataAndSoftwareAndUser = async () => {
        await db
            .insertInto("software_external_datas")
            .values(
                [softwareExternalData, similarSoftwareExternalData].map(softExtData => ({
                    ...softExtData,
                    sourceSlug: source.slug,
                    developers: JSON.stringify(softExtData.developers),
                    label: JSON.stringify(softExtData.label),
                    description: JSON.stringify(softExtData.description),
                    keywords: JSON.stringify(softExtData.keywords),
                    applicationCategories: JSON.stringify(softExtData.applicationCategories),
                    programmingLanguages: JSON.stringify(softExtData.programmingLanguages),
                    identifiers: JSON.stringify(softExtData.identifiers),
                    referencePublications: JSON.stringify(softExtData.referencePublications)
                }))
            )
            .execute();

        const userId = await dbApi.user.add(insertedUser);

        const softwareId = await dbApi.software.create({
            formData: softwareFormData,
            userId
        });

        return {
            softwareId,
            userId
        };
    };
});
