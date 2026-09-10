// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import * as Sentry from "@sentry/react";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
    createDsfrCustomBrandingProvider,
    MuiDsfrThemeProvider
} from "@codegouvfr/react-dsfr/mui";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import { assert } from "tsafe/assert";
import { projectVersion } from "./tools/projectVersion";
import "./ui/i18n/i18next";
import { createTheme } from "@mui/material";
import catalogiLogoUrl from "../public/white-label/cropped-Lumen_LOGO1-180x180.png";

if (import.meta.env.SENTRY_DSN_WEB) {
    Sentry.init({
        dsn: import.meta.env.SENTRY_DSN_WEB,
        environment: import.meta.env.ENVIRONMENT,
        release: projectVersion,
        sendDefaultPii: true,
        tracesSampleRate: 1.0,
        integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
        replaysSessionSampleRate: 0.01,
        replaysOnErrorSampleRate: 1.0
    });
    console.info(
        `Sentry initialized (environment: ${import.meta.env.ENVIRONMENT}, release: ${projectVersion})`
    );
} else {
    console.info(
        `Sentry not initialized - no DSN configured (environment: ${import.meta.env.ENVIRONMENT})`
    );
}

const { DsfrCustomBrandingProvider } = createDsfrCustomBrandingProvider({
    createMuiTheme: ({ isDark, theme_gov }) => {
        if (import.meta.env.VITE_FR_OFFICIAL === "true") {
            console.log("Use Gov");
            return { theme: theme_gov };
        }

        const customTheme = createTheme({
            palette: {
                mode: isDark ? "dark" : "light",
                primary: {
                    main: "#326d63"
                },
                secondary: {
                    main: "#f29100"
                }
            }
        });
        return { theme: customTheme, faviconUrl: catalogiLogoUrl };
    }
});

startReactDsfr({ defaultColorScheme: "system" });

const App = lazy(() => import("ui/App"));

createRoot(
    (() => {
        const rootElement = document.getElementById("root");

        assert(rootElement !== null);

        return rootElement;
    })()
).render(
    <Suspense>
        <DsfrCustomBrandingProvider>
            <App />
        </DsfrCustomBrandingProvider>
    </Suspense>
);
