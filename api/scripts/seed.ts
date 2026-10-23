// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

// the following script is used to seed the database with initial data

import { Insertable, Kysely } from "kysely";
import { createKyselyPgDbApi } from "../src/core/adapters/dbApi/kysely/createPgDbApi";
import { DbUser, DbApiV2 } from "../src/core/ports/DbApiV2";
import type {
    Database,
    RepoMetadata,
    SchemaIdentifier,
    SchemaOrganization,
    SchemaPerson,
    ScholarlyArticle,
    SoftwareExternalDatasTable,
    SourceConfig
} from "../src/core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../src/core/adapters/dbApi/kysely/kysely.dialect";
import { SoftwareFormData, Source } from "../src/lib/ApiTypes";
import type { LocalizedString } from "../src/core/ports/GetSoftwareExternalData";
import { OmitFromExisting } from "../src/core/utils";
import { makeCreateSofware } from "../src/core/usecases/createSoftware";
import { identifersUtils } from "../src/tools/identifiersTools";

const seed = async () => {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) throw new Error("DATABASE_URL environment variable is not set");

    const db = new Kysely<Database>({ dialect: createPgDialect(dbUrl) });

    const dbApi: DbApiV2 = createKyselyPgDbApi(db);

    // Forge sources use the slug `ensureForgeSource` derives from the host, so the update job
    // reuses them instead of creating duplicates.
    const sources: Array<Omit<Source, "configuration" | "lastImport" | "description">> = [
        { slug: "UserInput", url: "", kind: "UserInput", category: "UserInput" },
        { slug: "github-com", url: "https://github.com/", kind: "GitHub", category: "repository" },
        { slug: "gitlab-com", url: "https://gitlab.com", kind: "GitLab", category: "repository" },
        { slug: "gitlab-gnome-org", url: "https://gitlab.gnome.org", kind: "GitLab", category: "repository" },
        { slug: "code-videolan-org", url: "https://code.videolan.org", kind: "GitLab", category: "repository" },
        { slug: "wikidata", url: "https://www.wikidata.org/", kind: "wikidata", category: "wikidata" },
        {
            slug: "comptoir-du-libre",
            url: "https://comptoir-du-libre.org/",
            kind: "ComptoirDuLibre",
            category: "ComptoirDuLibre"
        }
    ];

    // Within one transaction so a failure can't lose the configurations. The rest of the seed
    // can't join it: dbApi opens its own transactions, which Kysely doesn't allow nesting.
    await db.transaction().execute(async trx => {
        // Source configurations hold credentials set by hand (e.g. the GitHub token): those of
        // the sources recreated below survive a reseed
        const previousConfigurationBySlug = new Map(
            (await trx.selectFrom("sources").select(["slug", "configuration"]).execute()).map(
                ({ slug, configuration }) => [slug, configuration]
            )
        );

        console.info("Clearing existing data");

        await trx.deleteFrom("software_external_datas").execute();
        await trx.deleteFrom("softwares__similar_software_external_datas").execute();
        await trx.deleteFrom("softwares").execute();
        await trx.deleteFrom("users").execute();
        await trx.deleteFrom("sources").execute();

        console.info("Adding sources");
        await trx
            .insertInto("sources")
            .values(
                sources.map(source => {
                    const configuration: SourceConfig | null | undefined = previousConfigurationBySlug.get(source.slug);
                    return {
                        ...source,
                        description: null,
                        configuration: configuration ? JSON.stringify(configuration) : null
                    };
                })
            )
            .execute();
    });

    console.info("Adding users");
    const seedUsers: Array<OmitFromExisting<DbUser, "id">> = [
        {
            email: "some@user.com",
            about: "This is a fake user for seeding purposes.",
            isPublic: true,
            organization: "Seed Organization",
            sub: null,
            role: "user"
        },
        {
            email: "test@example.com",
            about: undefined,
            isPublic: false,
            organization: "DINUM",
            sub: null,
            role: "admin"
        },
        ...(
            [
                ["alice.martin@example.org", "DINUM"],
                ["bruno.leroy@example.org", "Ministère de l'Éducation nationale"],
                ["chloe.bernard@example.org", "Ministère de l'Intérieur"],
                ["david.petit@example.org", "INSEE"],
                ["emma.robert@example.org", "Ministère de la Culture"],
                ["francois.durand@example.org", "CNRS"],
                ["gaelle.moreau@example.org", "Eurométropole de Strasbourg"],
                ["hugo.simon@example.org", "ADEME"]
            ] as const
        ).map(([email, organization]) => ({
            email,
            about: undefined,
            isPublic: true,
            organization,
            sub: null,
            role: "user" as const
        }))
    ];

    const userIdByEmail = new Map<string, number>();
    for (const user of seedUsers) {
        userIdByEmail.set(user.email, await dbApi.user.add(user));
    }
    const getUserId = (email: string) => {
        const id = userIdByEmail.get(email);
        if (id === undefined) throw new Error(`Unknown seed user ${email}`);
        return id;
    };
    const userId = getUserId("some@user.com");

    const UCCreateSofware = makeCreateSofware({ dbApi, withUserInput: true });

    console.info("Adding software packages");
    const softwarePackagesFormData: SoftwareFormData[] = [
        {
            name: "React",
            nameOverride: null,
            description: "A JavaScript library for building user interfaces.",
            operatingSystems: {},
            runtimePlatforms: [],
            externalIdForSource: "Q19399674",
            sourceSlug: "wikidata",
            license: "MIT",
            similarSoftwareExternalDataItems: [],
            image: "https://react.dev/favicon.ico",
            keywords: ["javascript", "ui", "frontend", "library"],
            customAttributes: { versionMin: "18.0.0" },
            isLibreSoftware: true,
            url: "https://react.dev",
            codeRepositoryUrl: "https://github.com/facebook/react",
            softwareHelp: "https://react.dev/learn",
            latestVersion: null,
            programmingLanguages: []
        },
        {
            name: "Git",
            nameOverride: "Git",
            description: "A free and open source distributed version control system.",
            operatingSystems: { mac: true, windows: true, linux: true, android: false, ios: false },
            runtimePlatforms: ["desktop"],
            externalIdForSource: "Q186055",
            sourceSlug: "wikidata",
            license: "GPL-2.0",
            similarSoftwareExternalDataItems: [],
            image: "https://git-scm.com/images/logos/downloads/Git-Icon-1788C.png",
            keywords: ["vcs", "version control", "git", "scm"],
            customAttributes: { versionMin: "2.0.0" },
            isLibreSoftware: true,
            url: "https://git-scm.com",
            codeRepositoryUrl: "https://github.com/git/git",
            softwareHelp: "https://git-scm.com/doc",
            latestVersion: null,
            programmingLanguages: []
        },
        {
            name: "OpenOffice",
            nameOverride: null,
            description:
                "An open-source office software suite for word processing, spreadsheets, presentations, graphics, databases and more.",
            operatingSystems: { mac: true, windows: true, linux: true, android: false, ios: false },
            runtimePlatforms: ["desktop"],
            externalIdForSource: "Q2858086",
            sourceSlug: "wikidata",
            license: "Apache-2.0",
            similarSoftwareExternalDataItems: [],
            image: "https://www.openoffice.org/images/AOO_logos/AOO_Logo_FullColor.svg",
            keywords: ["office", "suite", "word", "spreadsheet", "presentation"],
            customAttributes: { versionMin: "4.1.0" },
            isLibreSoftware: true,
            url: "https://www.openoffice.org",
            codeRepositoryUrl: "https://github.com/apache/openoffice",
            softwareHelp: "https://wiki.openoffice.org/wiki/Documentation",
            latestVersion: null,
            programmingLanguages: []
        },
        {
            // Repository on Gerrit, a forge Catalogi can't read: no repository source
            name: "LibreOffice",
            nameOverride: null,
            description:
                "Suite bureautique libre : traitement de texte, tableur, présentation, dessin et base de données.",
            operatingSystems: { mac: true, windows: true, linux: true, android: false, ios: false },
            runtimePlatforms: ["desktop"],
            externalIdForSource: "Q10135",
            sourceSlug: "wikidata",
            license: "MPL-2.0",
            similarSoftwareExternalDataItems: [],
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/LibreOffice_Logo_Flat.svg/250px-LibreOffice_Logo_Flat.svg.png",
            keywords: ["bureautique", "office", "tableur", "traitement de texte", "odf"],
            customAttributes: { versionMin: "24.8" },
            isLibreSoftware: true,
            url: "https://fr.libreoffice.org",
            codeRepositoryUrl: "https://git.libreoffice.org/core",
            softwareHelp: "https://help.libreoffice.org",
            latestVersion: { version: "25.8.2", releaseDate: "2025-10-09" },
            programmingLanguages: ["C++", "Java", "Python"]
        },
        {
            name: "VLC media player",
            nameOverride: "VLC media player",
            description: "A free and open source cross-platform multimedia player and framework.",
            operatingSystems: { mac: true, windows: true, linux: true, android: true, ios: true },
            runtimePlatforms: ["desktop", "mobile"],
            externalIdForSource: "Q171477",
            sourceSlug: "wikidata",
            license: "GPL-2.0",
            similarSoftwareExternalDataItems: [],
            image: "https://www.videolan.org/images/favicon.png",
            keywords: ["media", "player", "video", "audio", "vlc"],
            customAttributes: { versionMin: "3.0.0" },
            isLibreSoftware: true,
            url: "https://www.videolan.org/vlc/",
            codeRepositoryUrl: "https://code.videolan.org/videolan/vlc",
            softwareHelp: "https://docs.videolan.me/vlc-user/",
            latestVersion: null,
            programmingLanguages: ["C", "C++"]
        },
        {
            name: "GIMP",
            nameOverride: "GIMP",
            description: "GNU Image Manipulation Program: a free and open source image editor.",
            operatingSystems: { mac: true, windows: true, linux: true, android: false, ios: false },
            runtimePlatforms: ["desktop"],
            externalIdForSource: "Q8038",
            sourceSlug: "wikidata",
            license: "GPL-3.0",
            similarSoftwareExternalDataItems: [],
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/The_GIMP_icon_-_gnome.svg/250px-The_GIMP_icon_-_gnome.svg.png",
            keywords: ["image", "editor", "graphics", "gimp"],
            customAttributes: { versionMin: "2.10.0" },
            isLibreSoftware: true,
            url: "https://www.gimp.org",
            codeRepositoryUrl: "https://gitlab.gnome.org/GNOME/gimp",
            softwareHelp: "https://docs.gimp.org",
            latestVersion: null,
            programmingLanguages: ["C", "Python"]
        },
        {
            name: "Inkscape",
            nameOverride: null,
            description: "Logiciel libre de dessin vectoriel au format SVG.",
            operatingSystems: { mac: true, windows: true, linux: true, android: false, ios: false },
            runtimePlatforms: ["desktop"],
            externalIdForSource: "Q8041",
            sourceSlug: "wikidata",
            license: "GPL-2.0",
            similarSoftwareExternalDataItems: [],
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Inkscape_Logo.svg/250px-Inkscape_Logo.svg.png",
            keywords: ["vectoriel", "svg", "dessin", "illustration"],
            customAttributes: { versionMin: "1.3" },
            isLibreSoftware: true,
            url: "https://inkscape.org",
            codeRepositoryUrl: "https://gitlab.com/inkscape/inkscape",
            softwareHelp: "https://inkscape.org/learn/",
            latestVersion: null,
            programmingLanguages: ["C++"]
        },
        {
            name: "Onyxia",
            nameOverride: null,
            description: "Application web pour simplifier la configuration d'environnement datascience sur Kubernetes.",
            operatingSystems: {},
            runtimePlatforms: ["cloud"],
            externalIdForSource: "Q110492908",
            sourceSlug: "wikidata",
            license: "MIT",
            similarSoftwareExternalDataItems: [],
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Onyxia.svg/250px-Onyxia.svg.png",
            keywords: ["hébergement", "hosting", "plateforme", "platform", "cloud", "nuage"],
            customAttributes: { versionMin: "0.26.25" },
            isLibreSoftware: true,
            url: "https://www.onyxia.sh",
            codeRepositoryUrl: "https://github.com/InseeFrLab/onyxia",
            softwareHelp: "https://docs.onyxia.sh",
            latestVersion: null,
            programmingLanguages: []
        },
        {
            // Repository on a Forgejo instance, not supported yet, and no Wikidata entry:
            // everything comes from the form
            name: "Forgejo",
            nameOverride: null,
            description: "Forge logicielle libre et légère, gouvernée par sa communauté.",
            operatingSystems: { mac: true, windows: true, linux: true, android: false, ios: false },
            runtimePlatforms: ["cloud"],
            externalIdForSource: undefined,
            sourceSlug: "wikidata",
            license: "GPL-3.0-or-later",
            similarSoftwareExternalDataItems: [],
            image: "https://forgejo.org/images/forgejo-wordmark.svg",
            keywords: ["forge", "git", "hébergement de code"],
            customAttributes: { versionMin: "11.0" },
            isLibreSoftware: true,
            url: "https://forgejo.org",
            codeRepositoryUrl: "https://codeberg.org/forgejo/forgejo",
            softwareHelp: "https://forgejo.org/docs/latest/",
            latestVersion: { version: "13.0.1", releaseDate: "2025-10-16" },
            programmingLanguages: ["Go", "JavaScript"]
        }
    ];

    const softwareIdByName = new Map<string, number>();
    for (const formData of softwarePackagesFormData) {
        softwareIdByName.set(formData.name, await UCCreateSofware({ userId, formData }));
    }
    const getSoftwareId = (name: string) => {
        const id = softwareIdByName.get(name);
        if (id === undefined) throw new Error(`Unknown seed software ${name}`);
        return id;
    };

    // The creation form only fills the UserInput row: the rest of the page comes from the
    // external sources, so their rows are filled as the update job would, following the shape
    // each adapter produces. Forge project and user ids are illustrative.
    console.info("Adding external data");

    const gitHubContributor = (name: string, login: string, userId: number): SchemaPerson => ({
        "@type": "Person",
        name,
        url: `https://github.com/${login}`,
        identifiers: [identifersUtils.makeUserGitHubIdentifer({ name, userId, url: `https://github.com/${login}` })]
    });

    const gitLabMember = (gitLabUrl: string, name: string, username: string, userId: number): SchemaPerson => ({
        "@type": "Person",
        name,
        url: `${gitLabUrl}/${username}`,
        identifiers: [identifersUtils.makeUserGitLabIdentifer({ gitLabUrl, username, userId })]
    });

    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const repoMetadata = (params: { commit: number; issue: number; pullRequest: number }): RepoMetadata => ({
        healthCheck: {
            lastCommit: { dateCreated: daysAgo(params.commit) },
            lastClosedIssue: { dateModified: daysAgo(params.issue) },
            lastClosedIssuePullRequest: { dateModified: daysAgo(params.pullRequest) }
        }
    });

    type SeedExternalData = {
        softwareName: string;
        sourceSlug: string;
        externalId: string;
        name?: LocalizedString;
        description?: LocalizedString;
        authors?: Array<SchemaOrganization | SchemaPerson>;
        url?: string;
        codeRepositoryUrl?: string;
        softwareHelp?: string;
        license?: string;
        latestVersion?: { version: string; releaseDate: string };
        keywords?: string[];
        programmingLanguages?: string[];
        applicationCategories?: string[];
        referencePublications?: ScholarlyArticle[];
        dateCreated?: string;
        identifiers?: SchemaIdentifier[];
        providers?: SchemaOrganization[];
        repoMetadata?: RepoMetadata;
    };

    const toJson = (value: unknown) => (value === undefined ? null : JSON.stringify(value));

    const saveExternalData = async (data: SeedExternalData) => {
        const row: Insertable<SoftwareExternalDatasTable> = {
            softwareId: getSoftwareId(data.softwareName),
            sourceSlug: data.sourceSlug,
            externalId: data.externalId,
            authors: JSON.stringify(data.authors ?? []),
            name: toJson(data.name),
            description: toJson(data.description),
            isLibreSoftware: true,
            image: null,
            url: data.url ?? null,
            codeRepositoryUrl: data.codeRepositoryUrl ?? null,
            softwareHelp: data.softwareHelp ?? null,
            license: data.license ?? null,
            latestVersion: toJson(data.latestVersion),
            keywords: toJson(data.keywords),
            programmingLanguages: toJson(data.programmingLanguages),
            applicationCategories: toJson(data.applicationCategories),
            referencePublications: toJson(data.referencePublications),
            dateCreated: data.dateCreated === undefined ? null : new Date(data.dateCreated),
            identifiers: toJson(data.identifiers),
            providers: toJson(data.providers),
            repoMetadata: toJson(data.repoMetadata),
            operatingSystems: null,
            runtimePlatforms: null,
            lastDataFetchAt: new Date()
        };

        // The Wikidata rows already exist, created unfilled by the creation form
        await db
            .insertInto("software_external_datas")
            .values(row)
            .onConflict(oc => oc.columns(["externalId", "sourceSlug"]).doUpdateSet(row))
            .execute();
    };

    // Repository: the most trusted external source, right after the form. Same shape as the
    // GitHub adapter: name is owner/repo, the latest tag date doubles as dateCreated, topics
    // become keywords and only GitHub provides the health check.
    const gitHubRepository = (params: {
        softwareName: string;
        fullName: string;
        repoId: number;
        description: string;
        homepage?: string;
        license: string;
        latestTag: { version: string; releaseDate: string };
        topics: string[];
        languages: string[];
        contributors: SchemaPerson[];
        repoMetadata: RepoMetadata;
    }): SeedExternalData => {
        const repoUrl = `https://github.com/${params.fullName}`;
        return {
            softwareName: params.softwareName,
            sourceSlug: "github-com",
            externalId: params.fullName,
            name: { en: params.fullName },
            description: { en: params.description },
            authors: params.contributors,
            url: params.homepage,
            codeRepositoryUrl: repoUrl,
            license: params.license,
            latestVersion: params.latestTag,
            dateCreated: params.latestTag.releaseDate,
            keywords: params.topics,
            programmingLanguages: params.languages,
            identifiers: [identifersUtils.makeRepoGitHubIdentifer({ repoUrl, repoId: params.repoId })],
            repoMetadata: params.repoMetadata
        };
    };

    // Same shape as the GitLab adapter: no languages, no health check, members with at least
    // the developer role as authors.
    const gitLabRepository = (params: {
        softwareName: string;
        sourceSlug: string;
        gitLabUrl: string;
        pathWithNamespace: string;
        projectId: number;
        name: string;
        description: string;
        license: string;
        latestRelease: { version: string; releaseDate: string };
        topics: string[];
        members: SchemaPerson[];
    }): SeedExternalData => {
        const projectUrl = `${params.gitLabUrl}/${params.pathWithNamespace}`;
        return {
            softwareName: params.softwareName,
            sourceSlug: params.sourceSlug,
            externalId: String(params.projectId),
            name: { en: params.name },
            description: { en: params.description },
            authors: params.members,
            codeRepositoryUrl: projectUrl,
            softwareHelp: `${projectUrl}/-/blob/master/README.md`,
            license: params.license,
            latestVersion: params.latestRelease,
            dateCreated: params.latestRelease.releaseDate,
            keywords: params.topics,
            programmingLanguages: [],
            identifiers: [
                identifersUtils.makeRepoGitLabIdentifer({
                    gitLabUrl: params.gitLabUrl,
                    projectId: params.projectId,
                    projectName: params.pathWithNamespace
                })
            ]
        };
    };

    const repositories: SeedExternalData[] = [
        gitHubRepository({
            softwareName: "React",
            fullName: "facebook/react",
            repoId: 10270250,
            description: "The library for web and native user interfaces.",
            homepage: "https://react.dev",
            license: "MIT License",
            latestTag: { version: "v19.2.0", releaseDate: "2025-10-01T00:00:00.000Z" },
            topics: ["declarative", "frontend", "javascript", "library", "react", "ui"],
            languages: ["JavaScript", "TypeScript", "HTML", "CSS", "C++", "CoffeeScript"],
            contributors: [
                gitHubContributor("Sebastian Markbåge", "sebmarkbage", 63648),
                gitHubContributor("Andrew Clark", "acdlite", 3624098),
                gitHubContributor("Ricky", "rickhanlonii", 2440089)
            ],
            repoMetadata: repoMetadata({ commit: 1, issue: 2, pullRequest: 1 })
        }),
        gitHubRepository({
            softwareName: "Git",
            fullName: "git/git",
            repoId: 36502,
            description:
                "Git Source Code Mirror - This is a publish-only repository but pull requests can be turned into patches to the mailing list via GitGitGadget.",
            homepage: undefined,
            license: "Other",
            latestTag: { version: "v2.51.1", releaseDate: "2025-10-15T00:00:00.000Z" },
            topics: [],
            languages: ["C", "Shell", "Perl", "Tcl", "Python", "Makefile"],
            contributors: [
                gitHubContributor("Junio C Hamano", "gitster", 54884),
                gitHubContributor("Jeff King", "peff", 45925)
            ],
            repoMetadata: repoMetadata({ commit: 0, issue: 30, pullRequest: 3 })
        }),
        gitHubRepository({
            softwareName: "OpenOffice",
            fullName: "apache/openoffice",
            repoId: 39390386,
            description: "Apache OpenOffice",
            homepage: "https://openoffice.apache.org/",
            license: "Apache License 2.0",
            latestTag: { version: "AOO4115GA", releaseDate: "2023-12-22T00:00:00.000Z" },
            topics: ["libreoffice", "office", "openoffice"],
            languages: ["C++", "Java", "C", "Perl", "Basic"],
            contributors: [gitHubContributor("Jim Jagielski", "jimjag", 147537)],
            repoMetadata: repoMetadata({ commit: 210, issue: 380, pullRequest: 300 })
        }),
        gitHubRepository({
            softwareName: "Onyxia",
            fullName: "InseeFrLab/onyxia",
            repoId: 252224420,
            description: "Data science oriented container launcher",
            homepage: "https://onyxia.sh",
            license: "MIT License",
            latestTag: { version: "v10.27.0", releaseDate: "2025-10-08T00:00:00.000Z" },
            topics: ["datascience", "kubernetes", "onyxia", "vault"],
            languages: ["TypeScript", "JavaScript", "HTML", "Dockerfile"],
            contributors: [
                gitHubContributor("Joseph Garrone", "garronej", 6702424),
                gitHubContributor("Olivier Levitt", "olevitt", 2342437)
            ],
            repoMetadata: repoMetadata({ commit: 2, issue: 5, pullRequest: 2 })
        }),
        gitLabRepository({
            softwareName: "VLC media player",
            sourceSlug: "code-videolan-org",
            gitLabUrl: "https://code.videolan.org",
            pathWithNamespace: "videolan/vlc",
            projectId: 7,
            name: "VLC",
            description: "VLC media player",
            license: "GNU General Public License v2.0 or later",
            latestRelease: { version: "3.0.21", releaseDate: "2024-06-10T00:00:00.000Z" },
            topics: ["multimedia", "player", "video"],
            members: [
                gitLabMember("https://code.videolan.org", "Jean-Baptiste Kempf", "jbk", 2),
                gitLabMember("https://code.videolan.org", "Rémi Denis-Courmont", "Courmisch", 8)
            ]
        }),
        gitLabRepository({
            softwareName: "GIMP",
            sourceSlug: "gitlab-gnome-org",
            gitLabUrl: "https://gitlab.gnome.org",
            pathWithNamespace: "GNOME/gimp",
            projectId: 1848,
            name: "GIMP",
            description: "GNU Image Manipulation Program",
            license: "GNU General Public License v3.0",
            latestRelease: { version: "GIMP_3_0_6", releaseDate: "2025-10-06T00:00:00.000Z" },
            topics: ["graphics", "image-editor"],
            members: [
                gitLabMember("https://gitlab.gnome.org", "Jehan", "Jehan", 1240),
                gitLabMember("https://gitlab.gnome.org", "Michael Natterer", "mitch", 236)
            ]
        }),
        gitLabRepository({
            softwareName: "Inkscape",
            sourceSlug: "gitlab-com",
            gitLabUrl: "https://gitlab.com",
            pathWithNamespace: "inkscape/inkscape",
            projectId: 3472737,
            name: "inkscape",
            description: "Inkscape vector image editor",
            license: "GNU General Public License v2.0 or later",
            latestRelease: { version: "INKSCAPE_1_4_2", releaseDate: "2025-05-13T00:00:00.000Z" },
            topics: ["svg", "vector graphics"],
            members: [
                gitLabMember("https://gitlab.com", "Martin Owens", "doctormo", 141812),
                gitLabMember("https://gitlab.com", "Marc Jeanmougin", "Mc-", 1196340)
            ]
        })
    ];

    // Wikidata: the general description of the software and its authors. Same shape as the
    // Wikidata adapter: authors point to their Wikidata page, the latest version date doubles
    // as dateCreated, and categories and publications only come from HAL.
    const wikidataAuthor = (wikidataId: string, additionalType: "Person" | "Organization") => ({
        url: `https://www.wikidata.org/wiki/${wikidataId}`,
        identifiers: [identifersUtils.makeWikidataIdentifier({ wikidataId, additionalType })]
    });
    const wikidataPerson = (name: string, wikidataId: string): SchemaPerson => ({
        "@type": "Person",
        name,
        ...wikidataAuthor(wikidataId, "Person")
    });
    const wikidataOrganization = (name: string, wikidataId: string): SchemaOrganization => ({
        "@type": "Organization",
        name,
        ...wikidataAuthor(wikidataId, "Organization")
    });

    const wikidata = (
        params: Omit<
            SeedExternalData,
            "sourceSlug" | "identifiers" | "dateCreated" | "applicationCategories" | "referencePublications"
        >
    ): SeedExternalData => ({
        ...params,
        sourceSlug: "wikidata",
        dateCreated: params.latestVersion?.releaseDate,
        applicationCategories: [],
        referencePublications: [],
        identifiers: [
            identifersUtils.makeWikidataIdentifier({ wikidataId: params.externalId, additionalType: "Software" })
        ]
    });

    const wikidataEntries: SeedExternalData[] = [
        wikidata({
            softwareName: "React",
            externalId: "Q19399674",
            name: { fr: "React", en: "React" },
            description: { fr: "bibliothèque JavaScript", en: "JavaScript library for building user interfaces" },
            authors: [
                wikidataOrganization("Meta Platforms", "Q380"),
                wikidataPerson("Sebastian Markbåge", "Q108496793"),
                wikidataPerson("Dan Abramov", "Q98363379"),
                wikidataPerson("Andrew Clark", "Q108498206")
            ],
            url: "https://react.dev/",
            codeRepositoryUrl: "https://github.com/facebook/react",
            license: "MIT"
        }),
        wikidata({
            softwareName: "Git",
            externalId: "Q186055",
            name: { fr: "Git", en: "Git" },
            description: {
                fr: "logiciel de gestion de versions décentralisé",
                en: "distributed version control system"
            },
            authors: [
                wikidataPerson("Linus Torvalds", "Q34253"),
                wikidataOrganization("Software Freedom Conservancy", "Q2896872"),
                wikidataPerson("Junio C Hamano", "Q4495220")
            ],
            url: "https://git-scm.com/",
            codeRepositoryUrl: "https://github.com/git/git",
            license: "GPL-2.0-only"
        }),
        wikidata({
            softwareName: "OpenOffice",
            externalId: "Q2858086",
            name: { fr: "Apache OpenOffice", en: "Apache OpenOffice" },
            description: { fr: "suite bureautique", en: "office suite" },
            authors: [wikidataOrganization("Apache Software Foundation", "Q489709")],
            url: "https://www.openoffice.org/",
            codeRepositoryUrl: "https://github.com/apache/openoffice",
            license: "Apache-2.0"
        }),
        wikidata({
            softwareName: "LibreOffice",
            externalId: "Q10135",
            name: { fr: "LibreOffice", en: "LibreOffice" },
            description: { fr: "suite bureautique libre", en: "free and open-source office suite" },
            authors: [wikidataOrganization("TDF", "Q313103")],
            url: "https://www.libreoffice.org/",
            codeRepositoryUrl: "https://git.libreoffice.org/core",
            license: "MPL-2.0",
            latestVersion: { version: "25.8.2", releaseDate: "2025-10-09T00:00:00.000Z" }
        }),
        wikidata({
            softwareName: "VLC media player",
            externalId: "Q171477",
            name: { fr: "VLC media player", en: "VLC media player" },
            description: { fr: "lecteur multimédia libre", en: "free and open-source media player" },
            authors: [wikidataOrganization("VideoLAN", "Q1282963"), wikidataPerson("Jean-Baptiste Kempf", "Q58879462")],
            url: "https://www.videolan.org/vlc/",
            codeRepositoryUrl: "https://code.videolan.org/videolan/vlc",
            license: "GPL-2.0-or-later"
        }),
        wikidata({
            softwareName: "GIMP",
            externalId: "Q8038",
            name: { fr: "GIMP", en: "GIMP" },
            description: { fr: "logiciel de retouche d'image", en: "raster graphics editor" },
            authors: [
                wikidataPerson("Peter Mattis", "Q7175711"),
                wikidataPerson("Spencer Kimball", "Q7576106"),
                wikidataOrganization("The GNOME Project", "Q7735575")
            ],
            url: "https://www.gimp.org/",
            codeRepositoryUrl: "https://gitlab.gnome.org/GNOME/gimp",
            license: "GPL-3.0-or-later"
        }),
        wikidata({
            softwareName: "Inkscape",
            externalId: "Q8041",
            name: { fr: "Inkscape", en: "Inkscape" },
            description: { fr: "logiciel de dessin vectoriel", en: "vector graphics editor" },
            authors: [
                wikidataPerson("Bulia Byak", "Q120122099"),
                wikidataPerson("Johan B. C. Engelen", "Q120122120"),
                wikidataPerson("Peter Moulder", "Q120122133")
            ],
            url: "https://inkscape.org/",
            codeRepositoryUrl: "https://gitlab.com/inkscape/inkscape",
            license: "GPL-2.0-or-later"
        }),
        wikidata({
            softwareName: "Onyxia",
            externalId: "Q110492908",
            name: { fr: "Onyxia", en: "Onyxia" },
            description: { fr: "plateforme de datascience", en: "data science platform" },
            authors: [wikidataOrganization("INSEE", "Q156616"), wikidataPerson("Joseph Garrone", "Q111738960")],
            url: "https://www.onyxia.sh/",
            codeRepositoryUrl: "https://github.com/InseeFrLab/onyxia",
            license: "MIT"
        })
    ];

    // Comptoir du Libre: service providers. Same shape as the Comptoir du Libre adapter, with
    // the ids of its public export (providers trimmed to a few).
    const cdlProvider = (name: string, cdlUserId: number, website: string): SchemaOrganization => ({
        "@type": "Organization",
        name,
        url: website,
        identifiers: [
            identifersUtils.makeCDLIdentifier({
                cdlId: String(cdlUserId),
                url: `https://comptoir-du-libre.org/fr/users/${cdlUserId}`,
                additionalType: "Organization"
            })
        ]
    });

    const comptoirDuLibre = (params: {
        softwareName: string;
        cdlId: number;
        name: string;
        license: string;
        website: string;
        repository: string;
        cnllId?: number;
        framaLibreSlug?: string;
        wikidataId: string;
        providers: SchemaOrganization[];
    }): SeedExternalData => ({
        softwareName: params.softwareName,
        sourceSlug: "comptoir-du-libre",
        externalId: String(params.cdlId),
        name: { fr: params.name },
        description: { fr: "" },
        url: params.website,
        codeRepositoryUrl: params.repository,
        license: params.license,
        keywords: [],
        programmingLanguages: [],
        applicationCategories: [],
        referencePublications: [],
        identifiers: [
            identifersUtils.makeCDLIdentifier({
                cdlId: String(params.cdlId),
                url: `https://comptoir-du-libre.org/fr/softwares/${params.cdlId}`,
                additionalType: "Software"
            }),
            ...(params.cnllId === undefined
                ? []
                : [
                      identifersUtils.makeCNLLIdentifier({
                          cNNLId: String(params.cnllId),
                          url: `https://annuaire.cnll.fr/solutions/${params.cnllId}`
                      })
                  ]),
            ...(params.framaLibreSlug === undefined
                ? []
                : [
                      identifersUtils.makeFramaIndentifier({
                          framaLibreId: params.framaLibreSlug,
                          url: `https://framalibre.org/content/${params.framaLibreSlug}`,
                          additionalType: "Software"
                      })
                  ]),
            identifersUtils.makeWikidataIdentifier({
                wikidataId: params.wikidataId,
                url: `https://www.wikidata.org/wiki/${params.wikidataId}`,
                additionalType: "Software"
            })
        ],
        providers: params.providers
    });

    const comptoirDuLibreEntries: SeedExternalData[] = [
        comptoirDuLibre({
            softwareName: "LibreOffice",
            cdlId: 33,
            name: "LibreOffice",
            license: "LGPLv3",
            website: "https://fr.libreoffice.org/",
            repository: "https://github.com/LibreOffice/core.git",
            cnllId: 284,
            wikidataId: "Q10135",
            providers: [
                cdlProvider("Arawa", 55, "https://www.arawa.fr"),
                cdlProvider("Collabora", 61, "https://www.collabora.com"),
                cdlProvider("CIB", 63, "https://libreoffice.cib.de/"),
                cdlProvider("Igalia", 62, "https://www.igalia.com/"),
                cdlProvider("OpenGO", 54, "https://www.opengo.fr/")
            ]
        }),
        comptoirDuLibre({
            softwareName: "GIMP",
            cdlId: 67,
            name: "GIMP",
            license: "GNU GPLv3",
            website: "https://www.gimp.org/",
            repository: "https://gitlab.gnome.org/GNOME/gimp",
            cnllId: 431,
            framaLibreSlug: "gimp",
            wikidataId: "Q8038",
            providers: [
                cdlProvider("Artefacts", 226, "http://artefacts.coop"),
                cdlProvider("Dimitri Robert", 227, "https://formation-logiciel-libre.com"),
                cdlProvider("Microlinux", 295, "https://www.microlinux.fr")
            ]
        }),
        // Listed without any provider
        comptoirDuLibre({
            softwareName: "Onyxia",
            cdlId: 461,
            name: "Onyxia",
            license: "MIT",
            website: "https://datalab.sspcloud.fr",
            repository: "https://github.com/InseeFrLab/onyxia",
            wikidataId: "Q110492908",
            providers: []
        })
    ];

    for (const data of [...repositories, ...wikidataEntries, ...comptoirDuLibreEntries]) {
        await saveExternalData(data);
    }

    console.info("Adding similar softwares");
    const similar = (externalId: string, name: string, description: string, isLibreSoftware: boolean) => ({
        externalId,
        sourceSlug: "wikidata",
        name,
        description,
        isLibreSoftware
    });
    const libreOfficeSimilar = similar("Q10135", "LibreOffice", "Suite bureautique libre", true);
    const openOfficeSimilar = similar("Q2858086", "Apache OpenOffice", "Suite bureautique libre", true);
    const msOfficeSimilar = similar("Q11255", "Microsoft Office", "Suite bureautique propriétaire", false);
    const gimpSimilar = similar("Q8038", "GIMP", "Éditeur d'image matriciel libre", true);
    const inkscapeSimilar = similar("Q8041", "Inkscape", "Éditeur de graphisme vectoriel libre", true);
    const photoshopSimilar = similar("Q129793", "Adobe Photoshop", "Éditeur d'image matriciel propriétaire", false);
    const vscodeSimilar = similar("Q19841877", "Visual Studio Code", "Éditeur de code source", false);

    await dbApi.software.saveSimilarSoftwares([
        { softwareId: getSoftwareId("LibreOffice"), softwareExternalDataItems: [openOfficeSimilar, msOfficeSimilar] },
        { softwareId: getSoftwareId("OpenOffice"), softwareExternalDataItems: [libreOfficeSimilar, msOfficeSimilar] },
        { softwareId: getSoftwareId("GIMP"), softwareExternalDataItems: [inkscapeSimilar, photoshopSimilar] },
        { softwareId: getSoftwareId("Inkscape"), softwareExternalDataItems: [gimpSimilar] },
        { softwareId: getSoftwareId("Git"), softwareExternalDataItems: [vscodeSimilar] }
    ]);

    console.info("Adding users and referents");
    const declarations: Array<{
        software: string;
        email: string;
        referent?: { isExpert: boolean };
        useCaseDescription: string;
        os?: "windows" | "linux" | "mac" | "android" | "ios";
        serviceUrl?: string;
    }> = [
        {
            software: "LibreOffice",
            email: "alice.martin@example.org",
            referent: { isExpert: true },
            useCaseDescription: "Suite bureautique par défaut sur les postes de la direction.",
            os: "linux"
        },
        {
            software: "LibreOffice",
            email: "bruno.leroy@example.org",
            referent: { isExpert: false },
            useCaseDescription: "Déployé sur les postes des établissements scolaires.",
            os: "windows"
        },
        {
            software: "LibreOffice",
            email: "emma.robert@example.org",
            useCaseDescription: "Rédaction des notes et des tableaux de suivi budgétaire.",
            os: "windows"
        },
        {
            software: "LibreOffice",
            email: "gaelle.moreau@example.org",
            useCaseDescription: "Migration de 3 000 postes depuis Microsoft Office.",
            os: "windows"
        },
        {
            software: "LibreOffice",
            email: "hugo.simon@example.org",
            useCaseDescription: "Production des rapports d'étude.",
            os: "mac"
        },
        {
            software: "Onyxia",
            email: "david.petit@example.org",
            referent: { isExpert: true },
            useCaseDescription: "Plateforme SSP Cloud pour les statisticiens publics.",
            serviceUrl: "https://datalab.sspcloud.fr"
        },
        {
            software: "Onyxia",
            email: "francois.durand@example.org",
            referent: { isExpert: false },
            useCaseDescription: "Environnements de calcul pour les équipes de recherche."
        },
        {
            software: "Onyxia",
            email: "alice.martin@example.org",
            useCaseDescription: "Prototypage de traitements de données ouvertes."
        },
        {
            software: "GIMP",
            email: "emma.robert@example.org",
            referent: { isExpert: true },
            useCaseDescription: "Retouche des visuels pour les expositions numériques.",
            os: "linux"
        },
        {
            software: "GIMP",
            email: "bruno.leroy@example.org",
            useCaseDescription: "Ateliers d'arts plastiques en collège.",
            os: "windows"
        },
        {
            software: "Inkscape",
            email: "emma.robert@example.org",
            useCaseDescription: "Création des affiches et signalétiques.",
            os: "mac"
        },
        {
            software: "Git",
            email: "chloe.bernard@example.org",
            referent: { isExpert: true },
            useCaseDescription: "Gestion des sources des applications métier.",
            os: "linux"
        },
        {
            software: "Git",
            email: "david.petit@example.org",
            useCaseDescription: "Versionnement des programmes statistiques.",
            os: "linux"
        },
        {
            software: "VLC media player",
            email: "hugo.simon@example.org",
            useCaseDescription: "Lecture des vidéos de formation interne.",
            os: "windows"
        },
        {
            software: "Forgejo",
            email: "chloe.bernard@example.org",
            useCaseDescription: "Forge interne des équipes de développement."
        }
    ];

    for (const declaration of declarations) {
        const softwareId = getSoftwareId(declaration.software);
        const declarantId = getUserId(declaration.email);

        if (declaration.referent !== undefined) {
            await dbApi.softwareReferent.add({
                softwareId,
                userId: declarantId,
                isExpert: declaration.referent.isExpert,
                useCaseDescription: declaration.useCaseDescription,
                serviceUrl: declaration.serviceUrl ?? null
            });
            continue;
        }

        await dbApi.softwareUser.add({
            softwareId,
            userId: declarantId,
            useCaseDescription: declaration.useCaseDescription,
            os: declaration.os ?? null,
            version: "",
            serviceUrl: declaration.serviceUrl ?? null
        });
    }

    console.info("Adding instances for Onyxia");
    const onyxiaInstances = [
        {
            organization: "DINUM",
            targetAudience: "Agents de l'État",
            instanceUrl: "https://onyxia-demo.data.gouv.fr",
            isPublic: true
        },
        {
            organization: "Ministère de l'Intérieur",
            targetAudience: "Services de police et de gendarmerie",
            instanceUrl: "https://onyxia.interieur.gouv.fr",
            isPublic: false
        },
        {
            organization: "Ministère de l'Éducation Nationale",
            targetAudience: "Enseignants et chercheurs",
            instanceUrl: "https://onyxia.education.gouv.fr",
            isPublic: true
        },
        {
            organization: "INSEE",
            targetAudience: "Statisticiens du service statistique public",
            instanceUrl: "https://datalab.sspcloud.fr",
            isPublic: true
        },
        {
            organization: "INSEE",
            targetAudience: "Agents de l'INSEE (données confidentielles)",
            instanceUrl: "https://ls3.insee.fr",
            isPublic: false
        },
        {
            organization: "CNRS",
            targetAudience: "Laboratoires de recherche",
            instanceUrl: "https://onyxia.cnrs.fr",
            isPublic: true
        }
    ];

    for (const instanceData of onyxiaInstances) {
        await dbApi.instance.create({
            userId,
            formData: { ...instanceData, mainSoftwareSillId: getSoftwareId("Onyxia") }
        });
    }

    console.info("Dereferencing OpenOffice");
    await dbApi.software.unreference({
        softwareId: getSoftwareId("OpenOffice"),
        reason: "Projet peu maintenu, LibreOffice est recommandé à la place",
        time: new Date().toISOString(),
        dereferencedByUserId: getUserId("test@example.com")
    });
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
