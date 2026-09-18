import express, { type ErrorRequestHandler } from "express";
import type { Server } from "http";
import { afterEach, describe, expect, it } from "vitest";
import { createPublicApiRouter } from "./routes";
import { createOpenApiDocument } from "./openapi";
import catalog from "./fixtures/catalog-v2.json";

const servers: Server[] = [];
afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

async function serve(params: Parameters<typeof createPublicApiRouter>[0], prefix = "/api") {
    const app = express();
    app.use(createPublicApiRouter(params));
    const errorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
        res.status(500).end();
    };
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    return `http://127.0.0.1:${address.port}${prefix}`;
}

describe("public API documentation", () => {
    it.each(["/api", "/sill/api"])("serves standalone documentation and V2 under %s", async prefix => {
        const base = await serve({ getPublicList: async () => catalog, getDocument: createOpenApiDocument }, prefix);

        const redirect = await fetch(`${base}/docs`, { redirect: "manual" });
        expect(redirect.status).toBe(302);
        expect(redirect.headers.get("location")).toBe(`${prefix}/docs/`);
        const html = await (await fetch(`${base}/docs/`)).text();
        expect(html).toContain("./swagger-ui-bundle.js");
        expect(html).not.toContain("unpkg.com");
        for (const asset of ["swagger-ui-bundle.js", "swagger-ui.css", "init.js"]) {
            expect((await fetch(`${base}/docs/${asset}`)).status).toBe(200);
        }
        const spec = await (await fetch(`${base}/openapi.json`)).json();
        expect(Object.keys(spec.paths)).toEqual(["/v2/catalogi.json"]);
        expect(spec.servers).toEqual([{ url: "./" }]);
        expect(spec.paths["/v2/catalogi.json"].get.responses["200"].content["application/json"].schema).toEqual({
            type: "array",
            items: { $ref: "#/components/schemas/SoftwareV2" }
        });
        const response = await fetch(`${base}/v2/catalogi.json`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(catalog);
    });

    it("preserves instance redirects without fetching the catalogue", async () => {
        const base = await serve(
            {
                redirectUrl: "https://catalog.example",
                getPublicList: async () => {
                    throw new Error("Must not fetch on a redirect");
                }
            },
            "/sill/api"
        );
        const response = await fetch(`${base}/v2/catalogi.json`, { redirect: "manual" });
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe("https://catalog.example/sill/api/v2/catalogi.json");
    });

    it("rejects incompatible data and retries after a failed cache refresh", async () => {
        let data: unknown = [{ ...catalog[0], id: "broken-id" }];
        const base = await serve({ getPublicList: async () => data });
        expect((await fetch(`${base}/v2/catalogi.json`)).status).toBe(500);
        data = catalog;
        const response = await fetch(`${base}/v2/catalogi.json`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(catalog);
    });
});
