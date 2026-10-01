// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import * as Sentry from "@sentry/node";
import * as trpcExpress from "@trpc/server/adapters/express";
import compression from "compression";
import cors from "cors";
import express, { Handler } from "express";
import cookieParser from "cookie-parser";
import memoize from "memoizee";
import { Kysely } from "kysely";
import { basename as pathBasename } from "path";
import type { Equals } from "tsafe";
import { assert } from "tsafe/assert";
import { bootstrapCore } from "../core";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { compiledDataPrivateToPublic } from "../core/ports/CompileData";
import { DbApiV2 } from "../core/ports/DbApiV2";
import { Language, languages } from "../core/ports/GetSoftwareExternalData";
import { createContextFactory } from "./context";
import { createRouter } from "./router";
import { getTranslations } from "./translations/getTranslations";
import { createAuthRoutes } from "./authRoutes";
import { env } from "../env";
import { createPublicApiRouter } from "./publicApi/routes";
import { createOpenApiDocument } from "./publicApi/openapi";
import type { OidcParams } from "../core/usecases/auth/oidcClient";

const makeGetCatalogiJson = (redirectUrl: string | undefined, dbApi: DbApiV2): Handler => {
    const getMemoizedCompiledData = memoize(() => dbApi.getCompiledDataPrivate(), {
        promise: true,
        maxAge: 2 * 60 * 60 * 1000 // 2 hours
    });

    return async (req, res) => {
        if (redirectUrl !== undefined) {
            return res.redirect(redirectUrl + req.originalUrl);
        }

        const privateCompiledData = await getMemoizedCompiledData();
        const compiledDataPublicJson = JSON.stringify(compiledDataPrivateToPublic(privateCompiledData));

        res.setHeader("Content-Type", "application/json").send(Buffer.from(compiledDataPublicJson, "utf8"));
    };
};

export async function startRpcService(params: {
    oidcParams: OidcParams & { manageProfileUrl: string };
    port: number;
    isDevEnvironnement: boolean;
    redirectUrl?: string;
    databaseUrl: string;
    appUrl: string;
    initialAdminEmail?: string;
}) {
    const { redirectUrl, oidcParams, port, isDevEnvironnement, databaseUrl, appUrl, initialAdminEmail, ...rest } =
        params;

    assert<Equals<typeof rest, {}>>();

    console.log({ isDevEnvironnement });

    const kyselyDb = new Kysely<Database>({ dialect: createPgDialect(databaseUrl) });

    const { dbApi, useCases } = await bootstrapCore({
        dbConfig: {
            dbKind: "kysely",
            kyselyDb: kyselyDb
        },
        oidcKind: "http",
        oidcParams,
        initialAdminEmail
    });

    if (initialAdminEmail === undefined && !(await dbApi.user.hasAdmin())) {
        console.warn(
            "No Catalogi administrator exists. Set CATALOGI_INITIAL_ADMIN_EMAIL to an OIDC email address, restart Catalogi, then sign in with that address to initialize administration."
        );
    }

    const { createContext } = await createContextFactory({
        userRepository: dbApi.user,
        sessionRepository: dbApi.session,
        refreshSession: useCases.auth.refreshSession
    });

    const { router } = createRouter({
        useCases,
        dbApi,
        oidcParams,
        redirectUrl
    });

    const catalogiJsonHandler = makeGetCatalogiJson(redirectUrl, dbApi);

    const app = express();

    app.use(
        cors({
            origin: appUrl,
            credentials: true
        })
    )
        .use(compression() as any)
        .use(cookieParser())
        .use((req, _res, next) => (console.log("⬅", req.method, req.path), next()))
        .use("/public/healthcheck", (...[, res]) => res.sendStatus(200))
        .use(createAuthRoutes({ ...useCases.auth, appUrl, isDevEnvironnement }))
        .get("/auth/logout", async (req, res) => {
            try {
                const sessionId = req.cookies.sessionId;
                if (!sessionId) {
                    res.clearCookie("sessionId");
                    res.redirect(env.appUrl);
                    return;
                }

                const { logoutUrl } = await useCases.auth.initiateLogout({ sessionId });

                res.clearCookie("sessionId");
                res.redirect(logoutUrl);
            } catch (error) {
                Sentry.captureException(error);
                console.error("Logout error:", error);
                res.status(500).json({ error: "Logout failed" });
            }
        })
        .get("/auth/logout/callback", async (_, res) => {
            res.redirect(env.appUrl);
        })
        .get("/:lang/translations.json", async (req, res) => {
            const lang = req.params.lang as Language;
            try {
                if (!languages.includes(lang))
                    return res.status(404).json({
                        message: `No translations found for language : ${lang}. Only ${languages.join(", ")} are supported.`
                    });
                const translations = getTranslations(lang);
                return res.json(translations);
            } catch (error: any) {
                return res
                    .status(404)
                    .json({ message: `No translations found for language : ${lang}`, error: error.message });
            }
        })
        .use(
            createPublicApiRouter({
                getPublicList: () => dbApi.software.getPublicList(),
                redirectUrl,
                getDocument: isDevEnvironnement ? createOpenApiDocument : undefined
            })
        )
        .get(`*/catalogi.json`, catalogiJsonHandler)
        // the following is just for backward compatibility
        .get(`*/sill.json`, catalogiJsonHandler)
        .use(
            (() => {
                const trpcMiddleware = trpcExpress.createExpressMiddleware({
                    router,
                    createContext
                });

                return (req, res, next) => {
                    const proxyReq = new Proxy(req, {
                        get: (target, prop) => {
                            if (prop === "path") {
                                return `/${pathBasename(target.path)}`;
                            }
                            return Reflect.get(target, prop);
                        }
                    });

                    return trpcMiddleware(proxyReq, res, next);
                };
            })()
        );

    Sentry.setupExpressErrorHandler(app);

    app.listen(port, () => console.log(`Listening on port ${port}`));
}
