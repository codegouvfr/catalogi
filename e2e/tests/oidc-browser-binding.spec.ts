import { test, expect } from "@playwright/test";

test("an intercepted OIDC callback works only in its initiating browser", async ({
  browser,
  baseURL,
}) => {
  const initiator = await browser.newContext();
  const victim = await browser.newContext();
  try {
    const victimPage = await victim.newPage();
    await victimPage.goto(`${baseURL}/api/auth/login`);
    await victimPage.locator("#username").fill("test@example.com");
    await victimPage.locator("#password").fill("test123");
    await victimPage.locator("#kc-login").click({ noWaitAfter: true });
    await victimPage.waitForURL((url) => url.pathname === "/list", {
      waitUntil: "domcontentloaded",
    });
    const existingSession = (await victim.cookies()).find(
      (c) => c.name === "sessionId",
    );
    expect(existingSession).toBeDefined();

    const page = await initiator.newPage();
    let captureCallback!: (url: string) => void;
    const callback = new Promise<string>((resolve) => {
      captureCallback = resolve;
    });
    // Capture Keycloak's redirect before Chromium follows it and consumes the code.
    await initiator.route(
      /\/login-actions\/authenticate(?:\?|$)/,
      async (route) => {
        const response = await route.fetch({ maxRedirects: 0 });
        const location = response.headers()["location"];
        if (
          response.status() === 302 &&
          location &&
          new URL(location).pathname === "/api/auth/callback"
        ) {
          captureCallback(location);
          await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: "Callback intercepted",
          });
        } else {
          await route.fulfill({ response });
        }
      },
    );
    await page.goto(`${baseURL}/api/auth/login`);
    const transaction = (await initiator.cookies()).find(
      (c) => c.name === "oidcTransaction",
    );
    expect(transaction).toMatchObject({
      httpOnly: true,
      sameSite: "Lax",
      path: "/api/auth",
      secure: false,
    });
    await page.locator("#username").fill("test@example.com");
    await page.locator("#password").fill("test123");
    await page.locator("#kc-login").click({ noWaitAfter: true });
    const interceptedUrl = await callback;

    const rejected = await victimPage.goto(interceptedUrl, {
      waitUntil: "domcontentloaded",
    });
    expect(rejected?.status()).toBe(400);
    expect(await rejected?.json()).toEqual({
      error: "Invalid authentication callback",
    });
    expect(
      (await victim.cookies()).find((c) => c.name === "sessionId"),
    ).toEqual(existingSession);

    await page.goto(interceptedUrl, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/list", {
      waitUntil: "domcontentloaded",
    });
    const cookies = await initiator.cookies();
    expect(cookies.find((c) => c.name === "sessionId")).toBeDefined();
    expect(cookies.find((c) => c.name === "oidcTransaction")).toBeUndefined();
    expect(
      (
        await page.goto(interceptedUrl, { waitUntil: "domcontentloaded" })
      )?.status(),
    ).toBe(400);
  } finally {
    await initiator.close();
    await victim.close();
  }
});
