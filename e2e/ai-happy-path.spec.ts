import { test, expect, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser } from "./test-user";

/** Opens a HeroSelect's popover by its "<label>: add hero" trigger button, then picks a hero option inside it. */
async function pickHero(page: Page, label: string, heroName: string) {
  await page.getByRole("button", { name: `${label}: add hero` }).click();
  await page.getByRole("dialog", { name: label }).getByRole("option", { name: heroName }).click();
}

test("match advisor produces a real streamed AI response for a signed-in user", async ({ page }) => {
  const user = await createTestUser();

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/app/match");
    // Each HeroSelect is collapsed to an "Add hero +" trigger until
    // clicked — the search input and hero-card listbox only render once
    // its popover dialog opens.
    await pickHero(page, "Your hero", "Infernus");
    await pickHero(page, "Lane partner", "Seven");
    await pickHero(page, "Enemy laner 1", "Vindicta");
    await page.getByRole("button", { name: "Get match plan" }).click();

    const output = page.locator("pre");
    await expect(output).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      const text = await output.textContent();
      expect(text?.length ?? 0).toBeGreaterThan(50);
    }).toPass({ timeout: 30_000 });
  } finally {
    await deleteTestUser(user.userId);
  }
});
