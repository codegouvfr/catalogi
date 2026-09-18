// SPDX-License-Identifier: MIT
import { Router } from "express";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import memoize from "memoizee";
import { catalogV2Schema, type CatalogV2 } from "./schema";

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Documentation API — Catalogi</title><link rel="stylesheet" href="./swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="./swagger-ui-bundle.js"></script><script src="./init.js"></script></body></html>`;
const init = `window.onload = function () {
    SwaggerUIBundle({ url: "../openapi.json", dom_id: "#swagger-ui", deepLinking: true,
        validatorUrl: null, persistAuthorization: false, defaultModelsExpandDepth: 0 });
};`;

export function createPublicApiRouter(params: {
    getPublicList: () => Promise<unknown>;
    redirectUrl?: string;
    getDocument?: () => unknown;
}): Router {
    const router = Router();
    const getDocument = memoize(
        params.getDocument ?? (() => JSON.parse(readFileSync(join(__dirname, "openapi.json"), "utf8")))
    );
    const getCatalog = memoize(
        async (): Promise<CatalogV2> => {
            // Validate the JSON representation, including Date/URL serialization, once per cache refresh.
            const data = JSON.parse(JSON.stringify(await params.getPublicList()));
            return catalogV2Schema.parse(data);
        },
        { promise: true, maxAge: 2 * 60 * 60 * 1000 }
    );

    router.get("*/v2/catalogi.json", async (req, res, next) => {
        if (params.redirectUrl !== undefined) return res.redirect(params.redirectUrl + req.originalUrl);
        try {
            res.json(await getCatalog());
        } catch (error) {
            next(error);
        }
    });
    router.get("*/openapi.json", (_req, res) => res.json(getDocument()));
    const docs = Router();
    docs.get("/", (req, res) => {
        const pathname = req.originalUrl.split("?")[0];
        // Resolve against the browser URL: reverse proxies may strip the public prefix.
        if (!pathname.endsWith("/")) return res.redirect("docs/");
        res.type("html").send(html);
    });
    docs.get("/init.js", (_req, res) => res.type("application/javascript").send(init));
    const assets = dirname(require.resolve("swagger-ui-dist/package.json"));
    for (const file of ["swagger-ui-bundle.js", "swagger-ui.css"]) {
        docs.get(`/${file}`, (_req, res) => res.sendFile(join(assets, file)));
    }
    router.use("*/docs", docs);
    return router;
}
