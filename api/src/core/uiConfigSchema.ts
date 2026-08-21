// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { z } from "zod";
import { languages } from "./ports/GetSoftwareExternalData";

const strictObject = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();

const localizedStringSchema = z.union([z.string(), z.record(z.enum(languages), z.string())]);
const headerLinkIconSchema = z.enum(["bank", "compass"]).default("bank");

const headerSchema = strictObject({
    link: strictObject({
        enabled: z.boolean(),
        icon: headerLinkIconSchema,
        linkProps: strictObject({
            href: z.string().url()
        }),
        text: z.string()
    }),
    menu: strictObject({
        welcome: strictObject({
            enabled: z.boolean()
        }),
        catalog: strictObject({
            enabled: z.boolean()
        }),
        addSoftware: strictObject({
            enabled: z.boolean()
        }),
        about: strictObject({
            enabled: z.boolean()
        }),
        contribute: strictObject({
            enabled: z.boolean(),
            href: z.string()
        }),
        login: strictObject({
            enabled: z.boolean()
        })
    })
});

const useCaseConfigSchema = strictObject({
    enabled: z.boolean(),
    labelLinks: z.array(z.string()),
    buttonEnabled: z.boolean(),
    buttonLink: z.string()
});

const usecases = strictObject({
    declareReferent: useCaseConfigSchema,
    editSoftware: useCaseConfigSchema,
    addSoftwareOrService: useCaseConfigSchema
});

export type ConfigurableUseCaseName = keyof z.infer<typeof usecases>;

const statsSchema = z.enum(["softwareCount", "registeredUserCount", "agentReferentCount", "organizationCount"]);

const softwareSelectionCardSchema = strictObject({
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
});

export type SoftwareSelectionCard = z.infer<typeof softwareSelectionCardSchema>;

const homeSchema = strictObject({
    softwareSelection: strictObject({
        enabled: z.boolean(),
        cards: z.array(softwareSelectionCardSchema).optional()
    }),
    theSillInAFewWordsParagraphLinks: z.array(z.string().url()),
    searchBar: strictObject({
        enabled: z.boolean()
    }),
    statistics: strictObject({
        categories: z.array(statsSchema)
    }),
    usecases,
    quickAccess: strictObject({
        enabled: z.boolean()
    })
});

const softwareDetailsSchema = strictObject({
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
    customAttributes: strictObject({
        enabled: z.boolean()
    }),
    metadata: strictObject({
        enabled: z.boolean(),
        fields: strictObject({
            keywords: z.boolean(),
            programmingLanguages: z.boolean(),
            applicationCategories: z.boolean(),
            runtimePlatforms: z.boolean()
        })
    }),
    repoMetadata: strictObject({
        enabled: z.boolean()
    }),
    links: strictObject({
        enabled: z.boolean()
    }),
    userActions: strictObject({
        enabled: z.boolean()
    })
});

const catalogSchema = strictObject({
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
    cardOptions: strictObject({
        referentCount: z.boolean(),
        userCase: z.boolean()
    })
});

const footerSchema = strictObject({
    domains: z.array(z.string())
});

export type UiConfig = z.infer<typeof uiConfigSchema>;
export const uiConfigSchema = strictObject({
    header: headerSchema,
    home: homeSchema,
    softwareDetails: softwareDetailsSchema,
    catalog: catalogSchema,
    footer: footerSchema
});
