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

    await expect(page.getByRole("heading", { name: "Git", exact: true })).toBeVisible();
    const summary = page.getByRole("region", { name: "Résumé" });
    await expect(summary.getByText("GPL-2.0")).toBeVisible();
    await expect(summary.getByText("vcs")).toBeVisible();
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
    await expect(page.locator(".fr-text--lead").getByText(/datascience/i)).toBeVisible();

    // Usages section, reached from the side menu: expand accordion to see instance URL
    await page.getByRole("navigation", { name: "Dans cette page" }).getByRole("link", { name: "Usages" }).click();
    const usages = page.getByRole("region", { name: "Usages" });
    await usages.getByRole("button", { name: /DINUM/i }).click();
    await expect(usages.getByText("onyxia-demo.data.gouv.fr")).toBeVisible();
});
