// SPDX-License-Identifier: MIT
import { z } from "zod";
import { articleSchema, identifierSchema, organizationSchema, personSchema } from "./schemaOrg";

const localizedString = z
    .union([z.string(), z.object({ fr: z.string().optional(), en: z.string().optional() })])
    .describe("Texte simple ou traductions indexées par langue (fr, en). Une traduction peut être absente.")
    .openapi("LocalizedString", { example: { fr: "Suite bureautique", en: "Office suite" } });
const timestamp = z.string().datetime({ offset: true });
const protection = z.object({ isProtected: z.boolean(), reason: z.string().optional() });

export const softwareV2Schema = z
    .object({
        id: z.number().int().describe("Identifiant du logiciel dans cette instance de Catalogi."),
        name: localizedString,
        description: localizedString,
        image: z.string().optional().describe("Adresse de l’image du logiciel."),
        url: z.string().optional().describe("Site officiel."),
        codeRepositoryUrl: z.string().optional(),
        softwareHelp: z.string().optional().describe("Adresse de la documentation ou de l’aide."),
        license: z.string(),
        latestVersion: z
            .object({
                version: z.string().optional(),
                releaseDate: z
                    .string()
                    .optional()
                    .describe("Date de publication fournie par la source, généralement YYYY-MM-DD.")
            })
            .optional(),
        addedTime: timestamp.describe("Date de référencement, au format ISO 8601."),
        updateTime: timestamp.describe("Date de mise à jour de la fiche, au format ISO 8601."),
        dereferencing: z
            .object({
                reason: z.string().optional(),
                time: timestamp,
                lastRecommendedVersion: z.string().optional(),
                dereferencedByUserId: z.number().optional()
            })
            .optional()
            .describe(
                "Présent si le logiciel est déréférencé. Filtrer les entrées possédant ce champ pour ne garder que les logiciels actifs."
            ),
        customAttributes: z
            .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
            .optional()
            .describe("Attributs propres à l’instance. Les dates sont sérialisées en chaînes ISO 8601."),
        protections: z.object({ dereferencing: protection.optional(), edition: protection.optional() }).optional(),
        applicationCategories: z.array(z.string()),
        keywords: z.array(
            z.union([
                z.string(),
                z
                    .object({
                        id: z.string(),
                        "numeric-id": z.number(),
                        "entity-type": z.literal("item")
                    })
                    .describe("Référence Wikidata historique, encore présente dans certaines fiches.")
            ])
        ),
        programmingLanguages: z.array(z.string()),
        authors: z.array(
            z.union([
                personSchema,
                organizationSchema,
                z
                    .object({
                        id: z.string(),
                        name: z.string(),
                        url: z.string().optional()
                    })
                    .describe("Auteur historique identifié dans Wikidata, sans attribut @type.")
            ])
        ),
        providers: z
            .array(organizationSchema)
            .describe("Prestataires associés au logiciel par les sources de données."),
        operatingSystems: z.object({
            windows: z.boolean().optional(),
            linux: z.boolean().optional(),
            mac: z.boolean().optional(),
            android: z.boolean().optional(),
            ios: z.boolean().optional()
        }),
        runtimePlatforms: z.array(z.enum(["cloud", "mobile", "desktop"])),
        isLibreSoftware: z.boolean().optional(),
        referencePublications: z.array(articleSchema).optional(),
        identifiers: z.array(identifierSchema).optional(),
        externalId: z
            .string()
            .optional()
            .describe("Identifiant externe à interpréter avec sourceSlug, par exemple Q215051 pour Wikidata."),
        sourceSlug: z
            .string()
            .optional()
            .describe("Source de l’identifiant externe. Peut être absent pour un logiciel saisi manuellement."),
        userAndReferentCountByOrganization: z.record(z.object({ userCount: z.number(), referentCount: z.number() })),
        similarSoftwares: z.array(
            z.object({
                externalId: z.string(),
                sourceSlug: z.string(),
                name: localizedString,
                description: localizedString,
                isLibreSoftware: z
                    .boolean()
                    .nullable()
                    .describe("null signifie que le caractère libre n’a pas pu être vérifié."),
                isInCatalogi: z.boolean(),
                softwareId: z.number().optional()
            })
        ),
        repoMetadata: z
            .object({
                healthCheck: z
                    .object({
                        lastCommit: z.object({ dateCreated: z.string() }).optional(),
                        lastClosedIssue: z.object({ dateModified: z.string() }).optional(),
                        lastClosedIssuePullRequest: z.object({ dateModified: z.string() }).optional()
                    })
                    .optional()
            })
            .optional()
    })
    .openapi("SoftwareV2");

export const catalogV2Schema = z.array(softwareV2Schema);
/** JSON wire contract, independent of database types (Date and URL serialize as strings). */
export type SoftwareV2 = z.infer<typeof softwareV2Schema>;
export type CatalogV2 = z.infer<typeof catalogV2Schema>;
