import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("shows login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("SIGAF");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "invalid@test.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator(".sonner-toast")).toContainText("Credenciales");
  });

  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*login.*/);
  });
});
