import { test as setup, expect } from "@playwright/test";

setup("authenticate", async ({ page, baseURL }) => {
    await page.goto(`/api/auth/login?redirectUrl=${baseURL}/list`);

    await page.locator("#username").fill("test@example.com");
    await page.locator("#password").fill("test123");
    await page.locator("#kc-login").click();

    await page.waitForURL("**/list**");

    // Wait for catalog cards to confirm the app loaded (org prompt dismissed)
    await expect(page.locator(".fr-card").first()).toBeVisible({ timeout: 15_000 });

    await page.context().storageState({ path: ".auth/user.json" });
});
