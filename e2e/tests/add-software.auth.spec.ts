import { test, expect } from "@playwright/test";

test("add a new software and verify it appears in the catalog", async ({ page }) => {
    await page.goto("/add");
    await expect(page).toHaveURL(/\/add/);

    // Step 1: select desktop software type, check Linux (force because DSFR label intercepts)
    await page
        .getByLabel("Logiciel installable sur poste de travail")
        .check({ force: true });
    await page.getByLabel("GNU/Linux").check({ force: true });
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 2: fill software info (use getByRole to disambiguate from wikidata combobox)
    await page
        .getByRole("textbox", { name: "Nom du logiciel" })
        .fill("E2E Test Software");
    await page
        .getByRole("textbox", { name: "Fonction du logiciel" })
        .fill("A test software for e2e");
    await page
        .getByRole("textbox", { name: "Licence du logiciel" })
        .fill("MIT");
    await page.getByLabel("Mot-clés").fill("e2e, test");
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 3: custom attributes — select first radio ("Oui") in each group
    const radioGroups = page.getByRole("group");
    const radioGroupCount = await radioGroups.count();

    for (let i = 0; i < radioGroupCount; i++) {
        const group = radioGroups.nth(i);
        const firstRadio = group.getByRole("radio").first();
        if (await firstRadio.isVisible().catch(() => false)) {
            await firstRadio.check({ force: true });
        }
    }

    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 4: similar software — skip, click submit
    await page
        .getByRole("button", { name: /Ajouter E2E Test Software/ })
        .click();

    // Should redirect to detail page or catalog
    await expect(page).toHaveURL(/\/(detail|list)/, { timeout: 15_000 });

    // Verify the software exists in the catalog
    await page.goto("/list");
    const searchInput = page.getByRole("search").locator("input");
    await searchInput.fill("E2E Test Software");
    await expect(
        page.locator(".fr-card").filter({
            has: page.locator("h3", { hasText: "E2E Test Software" })
        })
    ).toBeVisible({ timeout: 10_000 });
});
