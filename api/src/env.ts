// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { z } from "zod";

const zEnvConfiguration = z.object({
    "oidcParams": z.object({
        "issuerUri": z.string().nonempty(),
        "clientId": z.string().nonempty(),
        "clientSecret": z.string().nonempty(),
        "manageProfileUrl": z.string().nonempty()
    }),
    "databaseUrl": z.string(),
    "appUrl": z.string().url(),
    "isDevEnvironnement": z.boolean().default(false),
    "environment": z.enum(["local", "dev", "staging", "pre-production", "production"]).default("local"),
    "port": z.coerce.number().optional().default(8080),
    "importDataSourceOrigin": z.string().optional().default("wikidata"),
    "botUserEmail": z.string().optional(),
    "listToImport": z.array(z.string()).optional(),
    "updateSkipTimingInMinutes": z.number().optional(),
    // Only for increasing the rate limit on GitHub API
    // we use the GitHub API for pre filling the version when adding a software
    "githubPersonalAccessTokenForApiRateLimit": z.string().optional(),
    // Completely disable this instance and redirect to another url
    "redirectUrl": z.string().optional(),
    "sentryDsnApi": z.string().optional()
});

const envConfiguration = zEnvConfiguration.parse({
    "oidcParams": {
        "issuerUri": process.env.OIDC_ISSUER_URI,
        "clientId": process.env.OIDC_CLIENT_ID,
        "clientSecret": process.env.OIDC_CLIENT_SECRET,
        "manageProfileUrl": process.env.OIDC_MANAGE_PROFILE_URL
    },
    "port": parseInt(process.env.API_PORT ?? ""),
    "appUrl": process.env.APP_URL,
    "isDevEnvironnement": process.env.IS_DEV_ENVIRONNEMENT?.toLowerCase() === "true",
    "environment": process.env.ENVIRONMENT,
    "importDataSourceOrigin": process.env.IMPORT_DATA_SOURCE_ORIGIN,
    "redirectUrl": process.env.REDIRECT_URL,
    "databaseUrl": process.env.DATABASE_URL,
    "botUserEmail": process.env?.BOT_USER_EMAIL,
    "listToImport": process.env?.IMPORT_DATA_IDS?.split(","),
    "updateSkipTimingInMinutes": process.env?.UPDATE_SKIP_TIMING ? parseInt(process.env.UPDATE_SKIP_TIMING) : undefined,
    "githubPersonalAccessTokenForApiRateLimit": process.env.GITHUB_TOKEN,
    "sentryDsnApi": process.env.SENTRY_DSN_API
});

export const env = {
    ...envConfiguration,
    "oidcParams": {
        ...envConfiguration.oidcParams,
        "appUrl": envConfiguration.appUrl
    },
    "isDevEnvironnement": envConfiguration.isDevEnvironnement ?? false
};
