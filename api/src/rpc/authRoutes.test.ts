// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import { Server } from "node:http";
import { AddressInfo } from "node:net";
import { Kysely } from "kysely";
import { Database } from "../core/adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../core/adapters/dbApi/kysely/kysely.dialect";
import { createPgSessionRepository } from "../core/adapters/dbApi/kysely/createPgSessionRepository";
import { createPgUserRepository } from "../core/adapters/dbApi/kysely/createPgUserRepository";
import { makeInitiateAuth } from "../core/usecases/auth/initiateAuth";
import { makeHandleAuthCallback } from "../core/usecases/auth/handleAuthCallback";
import { TestOidcClient } from "../core/usecases/auth/oidcClient";
import { resetDB, testPgUrl } from "../tools/test.helpers";
import { createAuthRoutes } from "./authRoutes";

describe("OIDC HTTP browser binding", () => {
    let db: Kysely<Database>;
    let server: Server;
    let base: string;
    let oidcClient: TestOidcClient;
    let app: ReturnType<typeof express>;

    beforeEach(async () => {
        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        await resetDB(db);
        oidcClient = new TestOidcClient({
            issuerUri: "https://identity.example",
            clientId: "test",
            clientSecret: "secret",
            appUrl: "https://catalogi.example"
        });
        const sessionRepository = createPgSessionRepository(db);
        app = express()
            .use(cookieParser())
            .use(
                "/api",
                createAuthRoutes({
                    appUrl: "https://catalogi.example",
                    initiateAuth: makeInitiateAuth({ sessionRepository, oidcClient }),
                    handleAuthCallback: makeHandleAuthCallback({
                        sessionRepository,
                        oidcClient,
                        userRepository: createPgUserRepository(db)
                    })
                })
            );
        server = await new Promise<Server>(resolve => {
            const s = app.listen(0, "127.0.0.1", () => resolve(s));
        });
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        await new Promise<void>((resolve, reject) => {
            server.close(error => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
        await db.destroy();
    });

    // Independent cookie jars model two isolated browser contexts. Requests use real HTTP.
    const browser = (prefix = "/api") => {
        const cookies = new Map<string, string>();
        return {
            cookies,
            async get(path: string) {
                const response = await fetch(`${base}${prefix}${path}`, {
                    redirect: "manual",
                    headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") }
                });
                for (const header of response.headers.getSetCookie()) {
                    const [name, value] = header.split(";", 1)[0].split("=");
                    if (value) cookies.set(name, value);
                    else cookies.delete(name);
                }
                return response;
            }
        };
    };
    const login = async (context: ReturnType<typeof browser>) => {
        const response = await context.get("/auth/login?redirectUrl=%2Fdashboard");
        const state = new URL(response.headers.get("location")!).searchParams.get("state")!;
        return { response, callback: `/auth/callback?code=private-code&state=${state}` };
    };

    it.each([
        { appUrl: "http://catalogi.example", isDevEnvironnement: false, secure: true },
        { appUrl: "https://catalogi.example", isDevEnvironnement: false, secure: true },
        { appUrl: "https://catalogi.example", isDevEnvironnement: true, secure: true },
        { appUrl: "http://catalogi.example", isDevEnvironnement: true, secure: false }
    ])(
        "sets Secure=$secure for $appUrl with development=$isDevEnvironnement",
        async ({ appUrl, isDevEnvironnement, secure }) => {
            const sessionRepository = createPgSessionRepository(db);
            app.use(
                "/policy",
                createAuthRoutes({
                    appUrl,
                    isDevEnvironnement,
                    initiateAuth: makeInitiateAuth({ sessionRepository, oidcClient }),
                    handleAuthCallback: makeHandleAuthCallback({
                        sessionRepository,
                        oidcClient,
                        userRepository: createPgUserRepository(db)
                    })
                })
            );
            const context = browser("/policy");
            const started = await login(context);
            expect(started.response.headers.get("set-cookie")!.includes("; Secure")).toBe(secure);
            const callback = await context.get(started.callback);
            expect(callback.status).toBe(302);
            for (const cookie of callback.headers.getSetCookie()) {
                expect(cookie.includes("; Secure")).toBe(secure);
            }
            expect(callback.headers.getSetCookie()).toHaveLength(2);
        }
    );

    it("rejects A's callback in B, preserves B's login, and lets A complete and clears its temporary cookie", async () => {
        const a = browser();
        const b = browser();
        const bLogin = await login(b);
        await b.get(bLogin.callback);
        const existingSession = b.cookies.get("sessionId")!;
        const existingRecord = await createPgSessionRepository(db).findById(existingSession);
        const started = await login(a);
        expect(started.response.headers.get("set-cookie")).toMatch(
            /oidcTransaction=.+; Max-Age=600; Path=\/api\/auth;.*HttpOnly; Secure; SameSite=Lax/
        );
        const exchange = vi.spyOn(oidcClient, "exchangeCodeForTokens");
        const rejected = await b.get(started.callback);
        expect(rejected.status).toBe(400);
        expect(await rejected.json()).toEqual({ error: "Invalid authentication callback" });
        expect(rejected.headers.getSetCookie()).toEqual([]);
        expect(b.cookies.get("sessionId")).toBe(existingSession);
        expect(await createPgSessionRepository(db).findById(existingSession)).toEqual(existingRecord);
        expect(exchange).not.toHaveBeenCalled();
        const accepted = await a.get(started.callback);
        expect(accepted.status).toBe(302);
        expect(accepted.headers.get("location")).toBe("/dashboard");
        expect(a.cookies.has("oidcTransaction")).toBe(false);
        expect(a.cookies.has("sessionId")).toBe(true);
        expect(accepted.headers.getSetCookie().find(c => c.startsWith("oidcTransaction="))).toContain(
            "Path=/api/auth;"
        );
        expect(exchange).toHaveBeenCalledTimes(1);
        expect((await a.get(started.callback)).status).toBe(400);
    });

    it("accepts only the latest tab's transaction and keeps it after an older callback", async () => {
        const a = browser();
        const first = await login(a);
        const second = await login(a);
        const cookie = a.cookies.get("oidcTransaction");
        const exchange = vi.spyOn(oidcClient, "exchangeCodeForTokens");
        expect((await a.get(first.callback)).status).toBe(400);
        expect(a.cookies.get("oidcTransaction")).toBe(cookie);
        expect(exchange).not.toHaveBeenCalled();
        expect((await a.get(second.callback)).status).toBe(302);
    });

    it("rejects an expired transaction even when the browser still sends its cookie", async () => {
        const a = browser();
        const started = await login(a);
        await db
            .updateTable("user_sessions")
            .set({ createdAt: new Date(Date.now() - 10 * 60 * 1000) })
            .where("id", "=", a.cookies.get("oidcTransaction")!)
            .execute();
        const exchange = vi.spyOn(oidcClient, "exchangeCodeForTokens");
        const response = await a.get(started.callback);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "Invalid authentication callback" });
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(exchange).not.toHaveBeenCalled();
    });

    it.each(["", "?code=secret", "?code=secret&state=secret&state=other", "?code=secret&state=secret"])(
        "returns a controlled error for invalid query %s",
        async query => {
            const response = await browser().get(`/auth/callback${query}`);
            expect(response.status).toBe(400);
            expect(await response.json()).toEqual({ error: "Invalid authentication callback" });
            expect(response.headers.getSetCookie()).toEqual([]);
        }
    );

    it("clears a claimed transaction after provider failure without changing the authenticated cookie", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const a = browser();
        const initial = await login(a);
        await a.get(initial.callback);
        const sessionId = a.cookies.get("sessionId");
        const next = await login(a);
        vi.spyOn(oidcClient, "exchangeCodeForTokens").mockRejectedValue(new Error("secret-code-and-tokens"));
        const response = await a.get(next.callback);
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Authentication callback failed" });
        expect(a.cookies.has("oidcTransaction")).toBe(false);
        expect(a.cookies.get("sessionId")).toBe(sessionId);
        expect(log.mock.calls).toEqual([["OIDC authentication failed", { stage: "callback" }]]);
    });

    it("reports login failures without logging provider exceptions or request data", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(oidcClient, "getAuthorizationEndpoint").mockImplementation(() => {
            throw new Error("private-provider-token");
        });
        const response = await browser().get("/auth/login?redirectUrl=private-redirect");
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Authentication failed" });
        expect(log.mock.calls).toEqual([["OIDC authentication failed", { stage: "login" }]]);
    });

    it("does not report invalid callbacks as internal authentication failures", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const a = browser();
        const started = await login(a);
        expect((await browser().get(started.callback)).status).toBe(400);
        expect((await a.get("/auth/callback?code=private-code")).status).toBe(400);
        expect(log).not.toHaveBeenCalled();
    });
});
