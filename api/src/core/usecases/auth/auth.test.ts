import { beforeEach, describe, expect, it } from "vitest";
import { TestOidcClient } from "./oidcClient";
import { createPgSessionRepository } from "../../adapters/dbApi/kysely/createPgSessionRepository";
import { InitiateAuth, makeInitiateAuth } from "./initiateAuth";
import { Kysely } from "kysely";
import { Database } from "../../adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../../adapters/dbApi/kysely/kysely.dialect";
import { expectToEqual, expectToMatchObject, testPgUrl } from "../../../tools/test.helpers";
import { HandleAuthCallback, makeHandleAuthCallback } from "./handleAuthCallback";
import { makeInitiateLogout, InitiateLogout } from "./logout";
import { createPgUserRepository } from "../../adapters/dbApi/kysely/createPgUserRepository";
import { makeRefreshSession, RefreshSession } from "./refreshSession";

describe("Authentication workflow", () => {
    let oidcClient: TestOidcClient;
    let initiateAuth: InitiateAuth;
    let handleAuthCallback: HandleAuthCallback;
    let initiateLogout: InitiateLogout;
    let refreshSession: RefreshSession;
    let db: Kysely<Database>;

    beforeEach(async () => {
        oidcClient = new TestOidcClient({
            issuerUri: "https://auth.example.com",
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            appUrl: "https://example.com"
        });

        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });

        initiateAuth = makeInitiateAuth({
            sessionRepository: createPgSessionRepository(db),
            oidcClient
        });
        handleAuthCallback = makeHandleAuthCallback({
            sessionRepository: createPgSessionRepository(db),
            userRepository: createPgUserRepository(db),
            oidcClient
        });
        initiateLogout = makeInitiateLogout({
            sessionRepository: createPgSessionRepository(db),
            oidcClient
        });
        refreshSession = makeRefreshSession({
            sessionRepository: createPgSessionRepository(db),
            oidcClient
        });
    });

    it("initates auth flow, than triggers callback, than logout", async () => {
        const { sessionId } = await initiateAuth({ redirectUrl: "/dashboard" });
        expectToEqual(sessionId, expect.any(String));

        const session = await db.selectFrom("user_sessions").selectAll().where("id", "=", sessionId).executeTakeFirst();
        expectToMatchObject(session, {
            state: expect.any(String),
            redirectUrl: "/dashboard",
            expiresAt: null,
            userId: null
        });

        expectToEqual(oidcClient.calls, [
            {
                method: "getAuthorizationEndpoint",
                args: []
            }
        ]);

        // after the user log in we simulate the callback with a code
        const fakeCode = "my-identity-provided-code";

        const updatedSession = await handleAuthCallback({
            code: fakeCode,
            state: session!.state
        });

        expectToMatchObject(updatedSession, {
            userId: expect.any(Number),

            expiresAt: expect.any(Date),
            redirectUrl: "/dashboard",
            email: "test@example.com"
        });

        const user = await db
            .selectFrom("users")
            .selectAll()
            .where("id", "=", updatedSession.userId)
            .executeTakeFirst();

        expectToMatchObject(user, {
            email: "test@example.com",
            sub: "test-user-123"
        });

        expectToEqual(oidcClient.calls, [
            { method: "getAuthorizationEndpoint", args: [] },
            { method: "exchangeCodeForTokens", args: [fakeCode] },
            {
                method: "getUserInfo",
                args: ["test-token-my-identity-provided-code"]
            }
        ]);

        const { logoutUrl } = await initiateLogout({ sessionId });
        expectToEqual(typeof logoutUrl, "string");
        expectToEqual(logoutUrl.includes("logout"), true);

        expectToEqual(oidcClient.calls, [
            { method: "getAuthorizationEndpoint", args: [] },
            { method: "exchangeCodeForTokens", args: [fakeCode] },
            {
                method: "getUserInfo",
                args: ["test-token-my-identity-provided-code"]
            },
            { method: "logout", args: ["test-id-token-my-identity-provided-code"] }
        ]);

        const sessionAfterLogout = await db
            .selectFrom("user_sessions")
            .selectAll()
            .where("id", "=", sessionId)
            .executeTakeFirst();
        expectToMatchObject(sessionAfterLogout, {
            loggedOutAt: expect.any(Date)
        });
    });

    it("refreshes expired session using refresh token", async () => {
        const { sessionId } = await initiateAuth({ redirectUrl: "/dashboard" });
        const session = await db.selectFrom("user_sessions").selectAll().where("id", "=", sessionId).executeTakeFirst();

        const fakeCode = "auth-code-123";
        const authenticatedSession = await handleAuthCallback({
            code: fakeCode,
            state: session!.state
        });

        expectToMatchObject(authenticatedSession, {
            refreshToken: expect.any(String),
            accessToken: expect.any(String),
            expiresAt: expect.any(Date)
        });

        const oldAccessToken = authenticatedSession.accessToken;
        const oldRefreshToken = authenticatedSession.refreshToken;

        await db
            .updateTable("user_sessions")
            .set({ expiresAt: new Date(Date.now() - 1000) })
            .where("id", "=", sessionId)
            .execute();

        const expiredSession = await db
            .selectFrom("user_sessions")
            .selectAll()
            .where("id", "=", sessionId)
            .executeTakeFirst();

        expectToMatchObject(expiredSession, {
            refreshToken: oldRefreshToken,
            accessToken: oldAccessToken
        });
        expect(expiredSession!.expiresAt!.getTime()).toBeLessThan(Date.now());

        const refreshedSession = await refreshSession(expiredSession!);

        expectToMatchObject(refreshedSession, {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresAt: expect.any(Date)
        });

        expect(refreshedSession.accessToken).not.toEqual(oldAccessToken);
        expect(refreshedSession.expiresAt!.getTime()).toBeGreaterThan(Date.now());

        expectToEqual(oidcClient.calls.at(-1), {
            method: "refreshAccessToken",
            args: [oldRefreshToken]
        });
    });
});
