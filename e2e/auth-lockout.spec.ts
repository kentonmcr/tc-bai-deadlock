import { test, expect } from "@playwright/test";

test("signed-out visitor hitting a protected route by direct URL is redirected to login, not shown data", async ({
  page,
}) => {
  await page.goto("/app/match");

  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fapp%2Fmatch/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Match Advisor" })).toHaveCount(0);
});
