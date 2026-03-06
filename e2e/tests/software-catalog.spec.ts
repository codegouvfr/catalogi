import { test, expect } from "@playwright/test";

test("browse catalog, search, filter, and navigate to details", async ({ page }) => {
    await page.goto("/list");

    // Catalog loads with 6 software cards
    await expect(page.locator(".fr-card:has(h3)")).toHaveCount(6);

    // Search narrows results
    const searchInput = page.getByRole("search").locator("input");
    await searchInput.fill("React");
    await expect(page.locator(".fr-card:has(h3)")).toHaveCount(1);

    // Search with no match shows empty state
    await searchInput.fill("xyznonexistent");
    await expect(page.locator(".fr-card:has(h3)")).toHaveCount(0);

    // Environment filter works
    await page.goto("/list?environment=linux");
    await expect(page.locator(".fr-card:has(h3)")).toHaveCount(4);

    // Sort parameter loads without errors
    await page.goto("/list?sort=update_time");
    await expect(page.locator(".fr-card:has(h3)")).toHaveCount(6);

    // Click a card to navigate to its detail page
    const firstCardTitle = await page.locator(".fr-card h3").first().textContent();
    await page.locator(".fr-card a").first().click();
    await expect(page).toHaveURL(/\/detail/);
    await expect(page.getByRole("heading", { name: firstCardTitle!.trim(), exact: true })).toBeVisible();
});
