// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { z } from "zod";

const headerSchema = z.object({
    link: z.object({
        enabled: z.boolean(),
        linkProps: z.object({
            href: z.string().url()
        }),
        text: z.string()
    }),
    menu: z.object({
        welcome: z.object({
            enabled: z.boolean()
        }),
        catalog: z.object({
            enabled: z.boolean()
        }),
        addSoftware: z.object({
            enabled: z.boolean()
        }),
        about: z.object({
            enabled: z.boolean()
        }),
        contribute: z.object({
            enabled: z.boolean(),
            href: z.string()
        }),
        login: z.object({
            enabled: z.boolean()
        })
    })
});

const useCaseConfigSchema = z.object({
    enabled: z.boolean(),
    labelLinks: z.array(z.string()),
    buttonEnabled: z.boolean(),
    buttonLink: z.string()
});

const usecases = z.object({
    declareReferent: useCaseConfigSchema,
    editSoftware: useCaseConfigSchema,
    addSoftwareOrService: useCaseConfigSchema
});

export type ConfigurableUseCaseName = keyof z.infer<typeof usecases>;

const statsSchema = z.enum(["softwareCount", "registeredUserCount", "agentReferentCount", "organizationCount"]);

const homeSchema = z.object({
    softwareSelection: z.object({
        enabled: z.boolean()
    }),
    theSillInAFewWordsParagraphLinks: z.array(z.string().url()),
    searchBar: z.object({
        enabled: z.boolean()
    }),
    statistics: z.object({
        categories: z.array(statsSchema)
    }),
    usecases,
    quickAccess: z.object({
        enabled: z.boolean()
    })
});

const softwareDetailsSchema = z.object({
    authorCard: z.boolean(),
    defaultLogo: z.boolean(),
    details: z.object({
        enabled: z.boolean(),
        fields: z.object({
            registerDate: z.boolean(),
            minimalVersionRequired: z.boolean(),
            softwareCurrentVersion: z.boolean(),
            softwareCurrentVersionDate: z.boolean(),
            license: z.boolean()
        })
    }),
    customAttributes: z.object({
        enabled: z.boolean()
    }),
    metadata: z.object({
        enabled: z.boolean(),
        fields: z.object({
            keywords: z.boolean(),
            programmingLanguages: z.boolean(),
            applicationCategories: z.boolean(),
            softwareType: z.boolean()
        })
    }),
    links: z.object({
        enabled: z.boolean()
    }),
    userActions: z.object({
        enabled: z.boolean()
    })
});

const catalogSchema = z.object({
    defaultLogo: z.boolean(),
    search: z.object({
        options: z.object({
            organisation: z.boolean(),
            applicationCategories: z.boolean(),
            softwareType: z.boolean(),
            customAttributes: z.boolean(),
            programmingLanguages: z.boolean()
        })
    }),
    sortOptions: z.object({
        referent_count: z.boolean(),
        user_count: z.boolean(),
        added_time: z.boolean(),
        update_time: z.boolean(),
        latest_version_publication_date: z.boolean(),
        user_count_ASC: z.boolean(),
        referent_count_ASC: z.boolean()
    }),
    cardOptions: z.object({
        referentCount: z.boolean(),
        userCase: z.boolean()
    })
});

const footerSchema = z.object({
    domains: z.array(z.string())
});

export type UiConfig = z.infer<typeof uiConfigSchema>;
export const uiConfigSchema = z.object({
    header: headerSchema,
    home: homeSchema,
    softwareDetails: softwareDetailsSchema,
    catalog: catalogSchema,
    footer: footerSchema
});
