// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

// the following script is used to seed the database with initial data

import { Kysely } from "kysely";
import { createKyselyPgDbApi } from "../src/core/adapters/dbApi/kysely/createPgDbApi";
import { DbUser, DbApiV2 } from "../src/core/ports/DbApiV2";
import { Database } from "../src/core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../src/core/adapters/dbApi/kysely/kysely.dialect";
import { SoftwareFormData, Source } from "../src/lib/ApiTypes";
import { OmitFromExisting } from "../src/core/utils";
import { makeCreateSofware } from "../src/core/usecases/createSoftware";

const seed = async () => {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) throw new Error("DATABASE_URL environment variable is not set");

    const db = new Kysely<Database>({ dialect: createPgDialect(dbUrl) });

    const dbApi: DbApiV2 = createKyselyPgDbApi(db);

    // Clear existing data
    console.info("Clearing existing data");

    await db.deleteFrom("software_external_datas").execute();
    await db.deleteFrom("softwares__similar_software_external_datas").execute();
    await db.deleteFrom("softwares").execute();
    await db.deleteFrom("users").execute();
    await db.deleteFrom("sources").execute();

    console.info("Data cleared");

    console.info("Adding source");
    const source = {
        slug: "wikidata",
        description: undefined,
        url: "https://www.wikidata.org/",
        kind: "wikidata",
        priority: 1
    } satisfies Source;
    await db.insertInto("sources").values(source).execute();

    const someUser: OmitFromExisting<DbUser, "id"> = {
        email: "some@user.com",
        about: "This is a fake user for seeding purposes.",
        isPublic: true,
        organization: "Seed Organization",
        sub: null
    };

    const UCCreateSofware = makeCreateSofware(dbApi);

    console.info("Adding user");
    const userId = await dbApi.user.add(someUser);

    console.info("Adding software packages");
    const softwarePackagesFormData: SoftwareFormData[] = [
        {
            softwareName: "React",
            softwareDescription: "A JavaScript library for building user interfaces.",
            softwareType: {
                type: "stack"
            },
            externalIdForSource: undefined,
            sourceSlug: "wikidata",
            softwareLicense: "MIT",
            similarSoftwareExternalDataItems: [],
            softwareLogoUrl: "https://react.dev/favicon.ico",
            softwareKeywords: ["javascript", "ui", "frontend", "library"],
            customAttributes: { versionMin: "18.0.0" }
        },
        {
            softwareName: "Git",
            softwareDescription: "A free and open source distributed version control system.",
            softwareType: {
                type: "desktop/mobile",
                os: { mac: true, windows: true, linux: true, android: false, ios: false }
            },
            externalIdForSource: undefined,
            sourceSlug: "wikidata",
            softwareLicense: "GPL-2.0",
            similarSoftwareExternalDataItems: [],
            softwareLogoUrl: "https://git-scm.com/images/logos/downloads/Git-Icon-1788C.png",
            softwareKeywords: ["vcs", "version control", "git", "scm"],
            customAttributes: { versionMin: "2.0.0" }
        },
        {
            softwareName: "OpenOffice",
            softwareDescription:
                "An open-source office software suite for word processing, spreadsheets, presentations, graphics, databases and more.",
            softwareType: {
                type: "desktop/mobile",
                os: { mac: true, windows: true, linux: true, android: false, ios: false }
            },
            externalIdForSource: undefined,
            sourceSlug: "wikidata",
            softwareLicense: "Apache-2.0",
            similarSoftwareExternalDataItems: [],
            softwareLogoUrl: "https://www.openoffice.org/images/AOO_logos/AOO_Logo_FullColor.svg",
            softwareKeywords: ["office", "suite", "word", "spreadsheet", "presentation"],
            customAttributes: { versionMin: "4.1.0" }
        },
        {
            softwareName: "VLC media player",
            softwareDescription: "A free and open source cross-platform multimedia player and framework.",
            softwareType: {
                type: "desktop/mobile",
                os: { mac: true, windows: true, linux: true, android: true, ios: true }
            },
            externalIdForSource: undefined,
            sourceSlug: "wikidata",
            softwareLicense: "GPL-2.0",
            similarSoftwareExternalDataItems: [],
            softwareLogoUrl: "https://www.videolan.org/images/favicon.png",
            softwareKeywords: ["media", "player", "video", "audio", "vlc"],
            customAttributes: { versionMin: "3.0.0" }
        },
        {
            softwareName: "GIMP",
            softwareDescription: "GNU Image Manipulation Program: a free and open source image editor.",
            softwareType: {
                type: "desktop/mobile",
                os: { mac: true, windows: true, linux: true, android: false, ios: false }
            },
            externalIdForSource: undefined,
            sourceSlug: "wikidata",
            softwareLicense: "GPL-3.0",
            similarSoftwareExternalDataItems: [],
            softwareLogoUrl: "https://www.gimp.org/images/wilber-big.png",
            softwareKeywords: ["image", "editor", "graphics", "gimp"],
            customAttributes: { versionMin: "2.10.0" }
        },
        {
            softwareName: "Onyxia",
            softwareDescription:
                "Application web pour simplifier la configuration d'environnement datascience sur Kubernetes.",
            softwareType: {
                type: "cloud"
            },
            externalIdForSource: "Q110492908",
            sourceSlug: "wikidata",
            softwareLicense: "MIT",
            similarSoftwareExternalDataItems: [],
            softwareLogoUrl:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Onyxia.svg/250px-Onyxia.svg.png",
            softwareKeywords: ["hébergement", "hosting", "plateforme", "platform", "cloud", "nuage"],
            customAttributes: { versionMin: "0.26.25" }
        }
    ];

    for (const formData of softwarePackagesFormData) {
        await UCCreateSofware({ userId, formData });
    }

    // Add instances for Onyxia
    console.info("Adding instances for Onyxia");

    // Get the Onyxia software ID
    const onyxiaSoftware = await db
        .selectFrom("softwares")
        .select("id")
        .where("name", "=", "Onyxia")
        .executeTakeFirstOrThrow();

    const onyxiaInstances = [
        {
            mainSoftwareSillId: onyxiaSoftware.id,
            organization: "DINUM",
            targetAudience: "Agents de l'État",
            instanceUrl: "https://onyxia-demo.data.gouv.fr",
            isPublic: true
        },
        {
            mainSoftwareSillId: onyxiaSoftware.id,
            organization: "Ministère de l'Intérieur",
            targetAudience: "Services de police et de gendarmerie",
            instanceUrl: "https://onyxia.interieur.gouv.fr",
            isPublic: false
        },
        {
            mainSoftwareSillId: onyxiaSoftware.id,
            organization: "Ministère de l'Éducation Nationale",
            targetAudience: "Enseignants et chercheurs",
            instanceUrl: "https://onyxia.education.gouv.fr",
            isPublic: true
        }
    ];

    for (const instanceData of onyxiaInstances) {
        await dbApi.instance.create({ userId, formData: instanceData });
    }
};

seed()
    .then(() => {
        console.log("Database seeded successfully");
        process.exit(0);
    })
    .catch(error => {
        console.error("Error seeding database:", error.message);
        console.error(error);
        process.exit(1);
    });
