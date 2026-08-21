// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { Kysely, sql } from "kysely";
import { z } from "zod";

// This historical schema and fallback deliberately live in this create-and-initialize migration. Historical migrations
// must remain replayable after the runtime schema and customization files evolve.
const strictObject = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();
const localizedStringSchema = z.union([z.string(), z.record(z.enum(["fr", "en"]), z.string())]);
const useCaseConfigSchema = strictObject({
    enabled: z.boolean(),
    labelLinks: z.array(z.string()),
    buttonEnabled: z.boolean(),
    buttonLink: z.string()
});

const migrationUiConfigSchema = strictObject({
    header: strictObject({
        link: strictObject({
            enabled: z.boolean(),
            icon: z.enum(["bank", "compass"]).default("bank"),
            linkProps: strictObject({ href: z.string().url() }),
            text: z.string()
        }),
        menu: strictObject({
            welcome: strictObject({ enabled: z.boolean() }),
            catalog: strictObject({ enabled: z.boolean() }),
            addSoftware: strictObject({ enabled: z.boolean() }),
            about: strictObject({ enabled: z.boolean() }),
            contribute: strictObject({ enabled: z.boolean(), href: z.string() }),
            login: strictObject({ enabled: z.boolean() })
        })
    }),
    home: strictObject({
        softwareSelection: strictObject({
            enabled: z.boolean(),
            cards: z
                .array(
                    strictObject({
                        title: localizedStringSchema,
                        sort: z
                            .enum([
                                "added_time",
                                "update_time",
                                "latest_version_publication_date",
                                "user_count",
                                "referent_count",
                                "user_count_ASC",
                                "referent_count_ASC"
                            ])
                            .optional(),
                        attributeNames: z.array(z.string()).optional()
                    })
                )
                .optional()
        }),
        theSillInAFewWordsParagraphLinks: z.array(z.string().url()),
        searchBar: strictObject({ enabled: z.boolean() }),
        statistics: strictObject({
            categories: z.array(
                z.enum(["softwareCount", "registeredUserCount", "agentReferentCount", "organizationCount"])
            )
        }),
        usecases: strictObject({
            declareReferent: useCaseConfigSchema,
            editSoftware: useCaseConfigSchema,
            addSoftwareOrService: useCaseConfigSchema
        }),
        quickAccess: strictObject({ enabled: z.boolean() })
    }),
    softwareDetails: strictObject({
        authorCard: z.boolean(),
        defaultLogo: z.boolean(),
        details: strictObject({
            enabled: z.boolean(),
            fields: strictObject({
                registerDate: z.boolean(),
                minimalVersionRequired: z.boolean(),
                softwareCurrentVersion: z.boolean(),
                softwareCurrentVersionDate: z.boolean(),
                license: z.boolean()
            })
        }),
        customAttributes: strictObject({ enabled: z.boolean() }),
        metadata: strictObject({
            enabled: z.boolean(),
            fields: strictObject({
                keywords: z.boolean(),
                programmingLanguages: z.boolean(),
                applicationCategories: z.boolean(),
                runtimePlatforms: z.boolean()
            })
        }),
        repoMetadata: strictObject({ enabled: z.boolean() }),
        links: strictObject({ enabled: z.boolean() }),
        userActions: strictObject({ enabled: z.boolean() })
    }),
    catalog: strictObject({
        defaultLogo: z.boolean(),
        search: strictObject({
            options: strictObject({
                organisation: z.boolean(),
                applicationCategories: z.boolean(),
                runtimePlatforms: z.boolean(),
                customAttributes: z.boolean(),
                programmingLanguages: z.boolean()
            })
        }),
        sortOptions: strictObject({
            referent_count: z.boolean(),
            user_count: z.boolean(),
            added_time: z.boolean(),
            update_time: z.boolean(),
            latest_version_publication_date: z.boolean(),
            user_count_ASC: z.boolean(),
            referent_count_ASC: z.boolean()
        }),
        cardOptions: strictObject({ referentCount: z.boolean(), userCase: z.boolean() })
    }),
    footer: strictObject({ domains: z.array(z.string()) })
});

export const STANDARD_UI_CONFIG = migrationUiConfigSchema.parse({
    header: {
        link: {
            enabled: true,
            icon: "bank",
            linkProps: { href: "https://code.gouv.fr" },
            text: "Code Gouv"
        },
        menu: {
            welcome: { enabled: true },
            catalog: { enabled: true },
            addSoftware: { enabled: true },
            about: { enabled: true },
            contribute: {
                enabled: true,
                href: "mailto:floss@numerique.gouv.fr?subject=Demande d'accompagnement"
            },
            login: { enabled: true }
        }
    },
    home: {
        softwareSelection: { enabled: true },
        theSillInAFewWordsParagraphLinks: [
            "https://fr.wikipedia.org/wiki/Logiciel_libre",
            "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000033203039",
            "https://code.gouv.fr/sill/readme",
            "https://code.gouv.fr/fr/doc/licences-libres-dinum"
        ],
        searchBar: { enabled: false },
        statistics: {
            categories: ["softwareCount", "registeredUserCount", "agentReferentCount", "organizationCount"]
        },
        usecases: {
            declareReferent: { enabled: true, labelLinks: [], buttonEnabled: true, buttonLink: "" },
            editSoftware: { enabled: true, labelLinks: [], buttonEnabled: true, buttonLink: "" },
            addSoftwareOrService: { enabled: true, labelLinks: [], buttonEnabled: true, buttonLink: "" }
        },
        quickAccess: { enabled: false }
    },
    softwareDetails: {
        authorCard: false,
        defaultLogo: true,
        details: {
            enabled: true,
            fields: {
                registerDate: true,
                minimalVersionRequired: true,
                softwareCurrentVersion: true,
                softwareCurrentVersionDate: true,
                license: true
            }
        },
        customAttributes: { enabled: true },
        metadata: {
            enabled: true,
            fields: {
                keywords: true,
                programmingLanguages: true,
                applicationCategories: true,
                runtimePlatforms: true
            }
        },
        repoMetadata: { enabled: false },
        links: { enabled: true },
        userActions: { enabled: true }
    },
    catalog: {
        defaultLogo: true,
        search: {
            options: {
                organisation: true,
                applicationCategories: true,
                runtimePlatforms: true,
                customAttributes: true,
                programmingLanguages: false
            }
        },
        sortOptions: {
            referent_count: true,
            user_count: true,
            added_time: true,
            update_time: true,
            latest_version_publication_date: true,
            user_count_ASC: true,
            referent_count_ASC: true
        },
        cardOptions: { referentCount: true, userCase: true }
    },
    footer: { domains: ["info.gouv.fr", "service-public.fr", "legifrance.gouv.fr", "data.gouv.fr"] }
});

const getLegacyUiConfigPaths = (migrationDirectory: string) => {
    const activeTreeRoot = resolve(migrationDirectory, "../../../../..");
    const activeTreeRootParent = dirname(activeTreeRoot);
    const runsFromDist = basename(activeTreeRootParent) === "dist";
    const apiRoot = runsFromDist ? dirname(activeTreeRootParent) : activeTreeRootParent;
    const sourcePath = resolve(apiRoot, "src/customization/ui-config.json");
    const distPath = resolve(apiRoot, "dist/src/customization/ui-config.json");

    return runsFromDist ? [distPath, sourcePath] : [sourcePath, distPath];
};

export const readInitialUiConfig = async (migrationDirectory = __dirname) => {
    for (const legacyUiConfigPath of getLegacyUiConfigPaths(migrationDirectory)) {
        let serializedConfig: string;

        try {
            serializedConfig = await readFile(legacyUiConfigPath, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Unable to read legacy UI configuration at ${legacyUiConfigPath}: ${message}`);
        }

        let parsedConfig: unknown;
        try {
            parsedConfig = JSON.parse(serializedConfig);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Legacy UI configuration at ${legacyUiConfigPath} is not valid JSON: ${message}`);
        }

        const result = migrationUiConfigSchema.safeParse(parsedConfig);
        if (!result.success) {
            throw new Error(
                `Legacy UI configuration at ${legacyUiConfigPath} is incompatible with this Catalogi version: ${result.error.message}`
            );
        }

        return result.data;
    }

    return STANDARD_UI_CONFIG;
};

export async function up(db: Kysely<any>): Promise<void> {
    const initialConfig = await readInitialUiConfig();

    await sql`
        create table "config_ui" (
            "id" boolean primary key default true,
            "config" jsonb not null,
            "createdAt" timestamptz not null default now(),
            "updatedAt" timestamptz not null default now(),
            constraint "config_ui_singleton" check ("id")
        )
    `.execute(db);

    await sql`insert into "config_ui" ("id", "config") values (true, ${JSON.stringify(initialConfig)}::jsonb)`.execute(
        db
    );
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`drop table "config_ui"`.execute(db);
}
