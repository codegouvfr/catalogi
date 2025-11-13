// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import * as Sentry from "@sentry/node";
import { projectVersion } from "./tools/projectVersion";
import { env } from "./env";

if (env.sentryDsnApi) {
    Sentry.init({
        dsn: env.sentryDsnApi,
        environment: env.environment,
        release: projectVersion,
        tracesSampleRate: 1.0,
        sendDefaultPii: true
    });
}
