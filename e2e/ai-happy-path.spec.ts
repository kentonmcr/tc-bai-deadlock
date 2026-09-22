import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser } from "./test-user";

test("laning advisor produces a real streamed AI response for a signed-in user", async ({ page }) => {
  const user = await createTestUser();

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/app/laning");
    // The <select>'s accessible name incorporates its currently-selected
    // option text (e.g. "Your hero-- pick a hero --"), so match on the
    // stable label prefix rather than the exact composite string.
    await page.getByRole("combobox", { name: "Your hero" }).selectOption("1"); // Infernus
    await page.getByRole("combobox", { name: "Lane partner" }).selectOption("2"); // Seven
    await page.getByRole("combobox", { name: "Enemy laner 1" }).selectOption("3"); // Vindicta
    await page.getByRole("button", { name: "Get laning advice" }).click();

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
