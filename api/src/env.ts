// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { z } from "zod";

const zEnvConfiguration = z.object({
    "oidcParams": z.object({
        "issuerUri": z.string().nonempty(),
        "clientId": z.string().nonempty(),
        "clientSecret": z.string().nonempty()
    }),
    "databaseUrl": z.string(),
    "isDevEnvironnement": z.boolean().default(false),
    "port": z.coerce.number().optional().default(8080),
    "externalSoftwareDataOrigin": z.enum(["wikidata", "HAL"]).optional().default("wikidata"),
    "initializeSoftwareFromSource": z.boolean().default(false),
    "botAgentEmail": z.string().optional(),
    "listToImport": z.array(z.string()).optional(),
    // Completely disable this instance and redirect to another url
    "redirectUrl": z.string().optional()
});

const envConfiguration = zEnvConfiguration.parse({
    "oidcParams": {
        "issuerUri": process.env.OIDC_ISSUER_URI,
        "clientId": process.env.OIDC_CLIENT_ID,
        "clientSecret": process.env.OIDC_CLIENT_SECRET
    },
    "port": parseInt(process.env.API_PORT ?? ""),
    "isDevEnvironnement": process.env.IS_DEV_ENVIRONNEMENT?.toLowerCase() === "true",
    "externalSoftwareDataOrigin": process.env.EXTERNAL_SOFTWARE_DATA_ORIGIN,
    "redirectUrl": process.env.REDIRECT_URL,
    "databaseUrl": process.env.DATABASE_URL,
    "initializeSoftwareFromSource": process.env.INIT_SOFT_FROM_SOURCE?.toLowerCase() === "true",
    "botAgentEmail": process.env?.BOT_AGENT_EMAIL,
    "listToImport": process.env?.IMPORT_WIKIDATA?.split(",")
});

export const env = {
    ...envConfiguration,
    "isDevEnvironnement": envConfiguration.isDevEnvironnement ?? false
};
