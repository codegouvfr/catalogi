// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import * as Sentry from "@sentry/node";
import { projectVersion } from "./tools/projectVersion";
import { env } from "./env";

// The body of updateSource carries source credentials.
const dropCredentialBodies = <E extends Sentry.Event>(event: E): E => {
    if (event.request?.url?.includes("updateSource")) delete event.request.data;
    return event;
};

if (env.sentryDsnApi) {
    Sentry.init({
        dsn: env.sentryDsnApi,
        environment: env.environment,
        release: projectVersion,
        tracesSampleRate: 1.0,
        sendDefaultPii: true,
        beforeSend: dropCredentialBodies,
        beforeSendTransaction: dropCredentialBodies
    });
    console.info(`Sentry initialized (environment: ${env.environment}, release: ${projectVersion})`);
} else {
    console.info(`Sentry not initialized - no DSN configured (environment: ${env.environment})`);
}
