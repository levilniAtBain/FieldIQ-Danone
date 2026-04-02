import { test, expect } from "@playwright/test";

/**
 * Smoke tests — @smoke tag — run after every build.
 * These verify the critical happy path works end to end.
 * Requires the app + DB to be running (docker-compose up -d).
 */

test.describe("Smoke: Login flow @smoke", () => {
  test("shows login page at root redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/login/);
    await expect(page.getByText("FieldIQ")).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[id="email"]', "nobody@loreal.com");
    await page.fill('[id="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await expect(
      page.getByText(/invalid email or password/i)
    ).toBeVisible();
  });

  test("rep can log in and reach dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[id="email"]', "thomas.martin@loreal.com");
    await page.fill('[id="password"]', "password123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
  });

  test("rep can navigate to pharmacies list", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('[id="email"]', "thomas.martin@loreal.com");
    await page.fill('[id="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    // Navigate to pharmacies
    await page.click('a[href="/pharmacies"]');
    await expect(page).toHaveURL(/pharmacies/);
    await expect(page.getByText("Pharmacies")).toBeVisible();
  });

  test("rep can open pharmacy detail", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[id="email"]', "thomas.martin@loreal.com");
    await page.fill('[id="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    await page.goto("/pharmacies");
    const firstPharmacy = page.locator('a[href^="/pharmacies/"]').first();
    await firstPharmacy.click();
    await expect(page).toHaveURL(/pharmacies\/.+/);
    // Should show tabs
    await expect(page.getByRole("button", { name: /overview/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /visits/i })).toBeVisible();
  });

  test("manager sees team view", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[id="email"]', "marie.dupont@loreal.com");
    await page.fill('[id="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    // Manager nav should show "My Team"
    await expect(page.getByText(/my team/i)).toBeVisible();
  });

  test("rep can log out", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[id="email"]', "thomas.martin@loreal.com");
    await page.fill('[id="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    // Click logout
    await page.click('button[title="Sign out"]');
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});
