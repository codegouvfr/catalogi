// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-License-Identifier: MIT
import { Router, CookieOptions } from "express";
import { z } from "zod";
import { InitiateAuth, AUTH_TRANSACTION_DURATION_MS } from "../core/usecases/auth/initiateAuth";
import { HandleAuthCallback, InvalidAuthTransactionError } from "../core/usecases/auth/handleAuthCallback";

export function createAuthRoutes({
    initiateAuth,
    handleAuthCallback,
    appUrl,
    isDevEnvironnement = false
}: {
    initiateAuth: InitiateAuth;
    handleAuthCallback: HandleAuthCallback;
    appUrl: string;
    isDevEnvironnement?: boolean;
}): Router {
    const router = Router();
    // Use the public path, including the /api proxy prefix (and any deployment prefix).
    const cookieOptions: CookieOptions = {
        httpOnly: true,
        secure: !isDevEnvironnement || new URL(appUrl).protocol === "https:",
        sameSite: "lax", // The identity provider returns via a top-level GET navigation.
        path: `${new URL(appUrl).pathname.replace(/\/$/, "")}/api/auth`
    };
    const cookieName = "oidcTransaction";
    router.get("/auth/login", async (req, res) => {
        try {
            const { authUrl, sessionId } = await initiateAuth({
                redirectUrl: typeof req.query.redirectUrl === "string" ? req.query.redirectUrl : undefined
            });
            res.cookie(cookieName, sessionId, { ...cookieOptions, maxAge: AUTH_TRANSACTION_DURATION_MS });
            res.redirect(authUrl);
        } catch {
            // Only fixed metadata: provider errors and request context can contain credentials.
            console.error("OIDC authentication failed", { stage: "login" });
            res.status(500).json({ error: "Authentication failed" });
        }
    });
    router.get("/auth/callback", async (req, res) => {
        const query = z.object({ code: z.string().min(1), state: z.string().min(1) }).safeParse(req.query);
        if (!query.success) {
            res.status(400).json({ error: "Invalid authentication callback" });
            return;
        }
        try {
            const session = await handleAuthCallback({
                ...query.data,
                transactionId: typeof req.cookies?.[cookieName] === "string" ? req.cookies[cookieName] : undefined
            });
            res.clearCookie(cookieName, cookieOptions);
            res.cookie("sessionId", session.id, {
                httpOnly: true,
                secure: cookieOptions.secure,
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            res.redirect(session.redirectUrl || `${appUrl}/list`);
        } catch (error) {
            // Invalid callbacks must not erase another tab's pending transaction or an existing login.
            if (error instanceof InvalidAuthTransactionError) {
                res.status(400).json({ error: "Invalid authentication callback" });
                return;
            }
            // Once claimed, a transaction cannot be retried, even if the provider fails.
            // Report only fixed metadata, never provider exceptions or request context.
            console.error("OIDC authentication failed", { stage: "callback" });
            res.clearCookie(cookieName, cookieOptions);
            res.status(500).json({ error: "Authentication callback failed" });
        }
    });
    return router;
}
