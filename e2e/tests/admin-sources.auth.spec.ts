import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("tab", { name: "Sources" }).click();
});

test("admin sees the sources by category and drafts a new merge order", async ({
    page
}) => {
    const panel = page.getByRole("tabpanel", { name: "Sources" });

    await expect(panel.getByText("Toujours en premier", { exact: true })).toBeVisible();
    await expect(panel.getByRole("cell", { name: "github-com", exact: true })).toBeVisible();
    await expect(panel.getByLabel("Source interrogée par nom")).toHaveValue("wikidata");

    const saveOrder = panel.getByRole("button", { name: "Enregistrer l'ordre" });
    await expect(saveOrder).toBeHidden();

    await panel.getByRole("button", { name: "Descendre repository" }).click();
    await expect(saveOrder).toBeVisible();

    await panel.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(saveOrder).toBeHidden();
});

test("admin sets a forge token without ever reading it back", async ({ page }) => {
    // gitlab-gnome-org is not among the most used forges shown by default.
    await page.getByRole("button", { name: "Voir plus…" }).click();
    await page.getByRole("button", { name: "Modifier gitlab-gnome-org" }).click();

    const dialog = page.getByRole("dialog", { name: "Modifier la source gitlab-gnome-org" });
    await expect(dialog.getByLabel("URL")).toBeDisabled();

    await dialog.getByLabel("Nouvelle valeur").fill("e2e-token");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();

    await expect(dialog.getByText("Enregistré.", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Une valeur est définie/)).toBeVisible();
    await expect(dialog.getByText(/Appel d'essai réussi|appel d'essai à|essayé de joindre|n'a pas pu/)).toBeVisible({
        timeout: 20_000
    });
    await expect(dialog.getByLabel("Nouvelle valeur")).toHaveValue("");

    // Leave the seeded source as found, so the test can run again on the same database.
    await dialog.getByRole("button", { name: "Effacer" }).click();
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog.getByText("Aucune valeur définie.")).toBeVisible();
});
