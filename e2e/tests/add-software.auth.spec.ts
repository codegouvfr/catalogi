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

    // Step 3: custom attributes — select first radio ("Oui") in each group.
    // Skip the admin-only protection groups: checking "Oui" there makes the
    // reason field required and would block the step validation.
    const radioGroups = page.getByRole("group");
    const radioGroupCount = await radioGroups.count();

    for (let i = 0; i < radioGroupCount; i++) {
        const group = radioGroups.nth(i);
        const firstRadio = group.getByRole("radio").first();
        if (!(await firstRadio.isVisible().catch(() => false))) {
            continue;
        }
        const radioName = await firstRadio.getAttribute("name");
        if (radioName?.startsWith("protection_")) {
            continue;
        }
        // Center the radio in the viewport first: Playwright's minimal scroll
        // leaves it at the bottom edge, behind the sticky actions footer, and
        // the forced click would land on the footer instead of the radio.
        await firstRadio.evaluate(el =>
            el.scrollIntoView({ block: "center", behavior: "instant" })
        );
        await firstRadio.check({ force: true });
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
