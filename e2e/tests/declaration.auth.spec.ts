import { test, expect } from "@playwright/test";

test("declare as user of a software", async ({ page }) => {
    await page.goto("/list");

    await page
        .locator(".fr-card")
        .filter({ has: page.locator("h3", { hasText: "Git" }) })
        .locator("a")
        .first()
        .click();
    await expect(page).toHaveURL(/\/detail/);

    await page
        .getByRole("link", { name: "Se déclarer référent ou utilisateur" })
        .click();
    await expect(page).toHaveURL(/\/declaration/);

    // Step 1: select "user" type (use force because DSFR label intercepts pointer events)
    await page
        .getByLabel("Je suis un utilisateur de ce logiciel")
        .check({ force: true });
    await page.getByRole("button", { name: "Suivant" }).click();

    // Step 2: fill usecase and select OS
    await page
        .getByLabel("Décrivez en quelques mots votre cas d'usage")
        .fill("Testing e2e");

    await page
        .getByLabel("Dans quel environnement utilisez-vous ce logiciel ?")
        .selectOption("linux");

    await page
        .getByRole("button", { name: "Envoyer ma déclaration" })
        .click();

    // Should redirect back to software detail page
    await expect(page).toHaveURL(/\/detail/, { timeout: 10_000 });

    // Verify user declaration badge or stop-being-user button appears
    await expect(
        page.getByRole("button", { name: "Ne plus être utilisateur" })
    ).toBeVisible({ timeout: 10_000 });
});
