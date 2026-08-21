import { test, expect } from "@playwright/test";

test("admin can access the software creation form from the admin page", async ({
    page
}) => {
    await page.goto("/admin");

    const addSoftwareLink = page.getByRole("link", { name: "Ajouter une fiche" });
    await expect(addSoftwareLink).toBeVisible();

    await addSoftwareLink.click();

    await expect(page).toHaveURL(/\/add$/);
});
