import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser } from "./test-user";

test("match advisor produces a real streamed AI response for a signed-in user", async ({ page }) => {
  const user = await createTestUser();

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/app/match");
    // Each HeroSelect is a labeled listbox of hero-card options (not a
    // native <select>), so pick the option within the correctly-labeled
    // group rather than a combobox.
    await page.getByRole("listbox", { name: "Your hero" }).getByRole("option", { name: "Infernus" }).click();
    await page.getByRole("listbox", { name: "Lane partner" }).getByRole("option", { name: "Seven" }).click();
    await page
      .getByRole("listbox", { name: "Enemy laner 1" })
      .getByRole("option", { name: "Vindicta" })
      .click();
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
