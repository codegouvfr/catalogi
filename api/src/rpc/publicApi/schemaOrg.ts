// SPDX-License-Identifier: MIT
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import type { SchemaOrganization } from "../../core/adapters/dbApi/kysely/kysely.database";
import type { Json } from "./types";

extendZodWithOpenApi(z);

const websiteSchema = z
    .object({
        "@type": z.literal("Website"),
        name: z.string(),
        description: z.string().optional(),
        url: z.string(),
        additionalType: z.string().optional()
    })
    .openapi("Website");

export const identifierSchema = z
    .object({
        "@type": z.literal("PropertyValue"),
        name: z.string().optional(),
        value: z.string(),
        url: z.string().optional(),
        valueReference: z.string().optional(),
        subjectOf: websiteSchema.optional(),
        additionalType: z.string().optional()
    })
    .openapi("Identifier");

const organizationBaseSchema = z.object({
    "@type": z.literal("Organization"),
    name: z.string(),
    url: z.string().optional(),
    identifiers: z.array(identifierSchema).optional(),
    foundingDate: z.string().optional(),
    alternateName: z.array(z.string()).optional(),
    description: z.string().optional(),
    sameAs: z.array(z.string()).optional(),
    address: z
        .object({
            "@type": z.literal("PostalAddress"),
            addressCountry: z.string().optional(),
            addressCountryCode: z.string().optional(),
            addressRegion: z.string().optional(),
            addressLocality: z.string().optional(),
            postalCode: z.string().optional(),
            streetAddress: z.string().optional(),
            postOfficeBoxNumber: z.string().optional(),
            geo: z
                .object({
                    "@type": z.literal("GeoCoordinates"),
                    latitude: z.number(),
                    longitude: z.number(),
                    elevation: z.number().optional()
                })
                .optional()
        })
        .optional(),
    additionalType: z.array(z.string()).optional(),
    image: z.string().optional(),
    producer: z.array(z.string()).optional()
});

// Reuse the original recursive organization type, adapted to its JSON representation.
const organizationRef: z.ZodType<Json<SchemaOrganization>> = z
    .lazy(() => organizationSchema)
    .openapi({
        type: "object",
        allOf: [{ $ref: "#/components/schemas/Organization" }]
    });
export const organizationSchema = organizationBaseSchema
    .extend({
        parentOrganizations: z.array(organizationRef).optional(),
        memberOf: z.array(organizationRef).optional()
    })
    .openapi("Organization");

export const personSchema = z
    .object({
        "@type": z.literal("Person"),
        name: z.string(),
        identifiers: z.array(identifierSchema).optional(),
        url: z.string().optional(),
        affiliations: z.array(organizationSchema).optional(),
        producer: z.array(z.string()).optional()
    })
    .openapi("Person");

export const articleSchema = z
    .object({
        "@id": z.string(),
        "@type": z.literal("ScholarlyArticle"),
        identifiers: z.array(
            identifierSchema.extend({
                subjectOf: websiteSchema,
                additionalType: z.literal("Article")
            })
        ),
        headline: z.string().optional()
    })
    .openapi("ScholarlyArticle");
