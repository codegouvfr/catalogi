import { beforeEach, describe, expect, it } from "vitest";
import { TestOidcClient } from "./oidcClient";
import { createPgSessionRepository } from "../../adapters/dbApi/kysely/createPgSessionRepository";
import { InitiateAuth, makeInitiateAuth } from "./initiateAuth";
import { Kysely } from "kysely";
import { Database } from "../../adapters/dbApi/kysely/kysely.database";
import { createPgDialect } from "../../adapters/dbApi/kysely/kysely.dialect";
import { expectToEqual, expectToMatchObject, resetDB, testPgUrl } from "../../../tools/test.helpers";
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

    const authenticate = async (initialAdminEmail?: string) => {
        const { sessionId } = await initiateAuth({ redirectUrl: undefined });
        const session = await db
            .selectFrom("user_sessions")
            .select("state")
            .where("id", "=", sessionId)
            .executeTakeFirstOrThrow();
        const callback = makeHandleAuthCallback({
            sessionRepository: createPgSessionRepository(db),
            userRepository: createPgUserRepository(db),
            oidcClient,
            initialAdminEmail
        });

        return callback({ code: "auth-code", state: session.state });
    };

    const getAuthenticatedUserRole = async (initialAdminEmail?: string) => {
        const session = await authenticate(initialAdminEmail);
        const user = await db
            .selectFrom("users")
            .select("role")
            .where("id", "=", session.userId)
            .executeTakeFirstOrThrow();
        return user.role;
    };

    beforeEach(async () => {
        oidcClient = new TestOidcClient({
            issuerUri: "https://auth.example.com",
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            appUrl: "https://example.com"
        });

        db = new Kysely<Database>({ dialect: createPgDialect(testPgUrl) });
        await resetDB(db);

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

    it("creates the configured initial administrator when no administrator exists", async () => {
        await expect(getAuthenticatedUserRole("test@example.com")).resolves.toBe("admin");
    });

    it("does not promote the first arbitrary user when no initial administrator is configured", async () => {
        await expect(getAuthenticatedUserRole()).resolves.toBe("user");
    });

    it("does not promote an address other than the configured initial administrator", async () => {
        await expect(getAuthenticatedUserRole("someone-else@example.com")).resolves.toBe("user");
    });

    it("promotes an existing matching user", async () => {
        const userRepository = createPgUserRepository(db);
        await userRepository.add({
            sub: "test-user-123",
            email: "test@example.com",
            firstName: "Existing",
            lastName: "User",
            organization: null,
            isPublic: false,
            about: undefined,
            role: "user"
        });

        await expect(getAuthenticatedUserRole("test@example.com")).resolves.toBe("admin");
    });

    it("keeps an existing administrator and blocks a new automatic promotion", async () => {
        const userRepository = createPgUserRepository(db);
        const existingAdminId = await userRepository.add({
            sub: "existing-admin",
            email: "existing-admin@example.com",
            firstName: "Existing",
            lastName: "Admin",
            organization: null,
            isPublic: false,
            about: undefined,
            role: "admin"
        });

        await expect(getAuthenticatedUserRole("test@example.com")).resolves.toBe("user");
        await expect(
            db.selectFrom("users").select("role").where("id", "=", existingAdminId).executeTakeFirstOrThrow()
        ).resolves.toMatchObject({ role: "admin" });
    });

    it("compares the configured initial administrator address case-insensitively", async () => {
        await expect(getAuthenticatedUserRole("TEST@EXAMPLE.COM")).resolves.toBe("admin");
    });

    it("promotes a matching existing user whose stored email uses different casing", async () => {
        await createPgUserRepository(db).add({
            sub: null,
            email: "Test@Example.com",
            firstName: "Existing",
            lastName: "User",
            organization: null,
            isPublic: false,
            about: undefined,
            role: "user"
        });

        await expect(getAuthenticatedUserRole("TEST@EXAMPLE.COM")).resolves.toBe("admin");
        await expect(createPgUserRepository(db).getAll()).resolves.toHaveLength(1);
    });

    it("creates a single administrator when initial administrator callbacks run concurrently", async () => {
        await Promise.all(Array.from({ length: 8 }, () => authenticate("test@example.com")));

        const users = await createPgUserRepository(db).getAll();
        expect(users).toHaveLength(1);
        expect(users[0]).toMatchObject({
            email: "test@example.com",
            role: "admin"
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
            sub: "test-user-123",
            role: "user"
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
