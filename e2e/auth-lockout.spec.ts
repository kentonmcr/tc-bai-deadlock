import { test, expect } from "@playwright/test";

test("signed-out visitor hitting a protected route by direct URL is redirected to login, not shown data", async ({
  page,
}) => {
  await page.goto("/app/laning");

  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fapp%2Flaning/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Laning Advisor" })).toHaveCount(0);
});
