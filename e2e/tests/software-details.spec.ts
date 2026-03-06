import { test, expect } from "@playwright/test";

test("view desktop software details: name, license, keywords, platforms", async ({ page }) => {
    await page.goto("/list");
    await page
        .locator(".fr-card")
        .filter({ has: page.locator("h3", { hasText: "Git" }) })
        .locator("a")
        .first()
        .click();
    await expect(page).toHaveURL(/\/detail/);

    await expect(page.getByRole("heading", { name: "Git" })).toBeVisible();
    await expect(page.getByText("GPL-2.0")).toBeVisible();
    await expect(page.getByText("vcs")).toBeVisible();
    await expect(page.getByText(/plateformes supportées/i)).toBeVisible();

    // Back navigation returns to catalog
    await page.goBack();
    await expect(page).toHaveURL(/\/list/);
});

test("view cloud software details and instances", async ({ page }) => {
    await page.goto("/list");
    await page
        .locator(".fr-card")
        .filter({ has: page.locator("h3", { hasText: "Onyxia" }) })
        .locator("a")
        .first()
        .click();
    await expect(page).toHaveURL(/\/detail/);

    await expect(page.getByRole("heading", { name: "Onyxia", exact: true })).toBeVisible();
    await expect(page.getByText(/datascience/i)).toBeVisible();

    // Instances tab: expand accordion to see instance URL
    await page.getByRole("tab", { name: /instance/i }).click();
    await expect(page.getByText("DINUM")).toBeVisible();
    await page.getByRole("button", { name: /DINUM/i }).click();
    await expect(page.getByText("onyxia-demo.data.gouv.fr")).toBeVisible();
});
