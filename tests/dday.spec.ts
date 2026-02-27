import { test, expect } from '@playwright/test';

test('D-Day calculator basic flow', async ({ page }) => {
  await page.goto('http://localhost:3000/service');
  await expect(page.locator('h2')).toHaveText(/복무기간/, { timeout: 10000 });
  // input an enlistment date
  await page.fill('input[type="date"]', '2024-08-15');
  await page.selectOption('select', 'army');
  await page.waitForTimeout(300);
  await expect(page.locator('text=전역일')).toBeVisible();
});
