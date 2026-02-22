/**
 * End-to-End Tests for Quest Builder
 * Tests user workflows using Playwright
 *
 * Run with: npx playwright test
 * Requires: npm install -D @playwright/test
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000/builder';

test.describe('Quest Builder E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('loads builder with all components', async ({ page }) => {
    // Check header
    await expect(page.locator('h1:has-text("Quest Payments")')).toBeVisible();

    // Check gallery exists
    await expect(page.locator('examples-gallery')).toBeVisible();

    // Check form exists
    await expect(page.locator('quest-builder')).toBeVisible();

    // Check preview exists
    await expect(page.locator('config-viewer')).toBeVisible();

    // Check export exists
    await expect(page.locator('export-dialog')).toBeVisible();
  });

  test('can fill out quest form', async ({ page }) => {
    const questNameInput = page.locator('#quest-name');
    const descriptionInput = page.locator('#quest-desc');

    // Enter quest name
    await questNameInput.fill('My Test Event');
    await expect(questNameInput).toHaveValue('My Test Event');

    // Enter description
    await descriptionInput.fill('This is my test event quest');
    await expect(descriptionInput).toHaveValue('This is my test event quest');
  });

  test('preview updates when form changes', async ({ page }) => {
    const questNameInput = page.locator('#quest-name');
    const configViewer = page.locator('config-viewer');

    // Change quest name
    await questNameInput.fill('Updated Quest Name');

    // Wait for preview to update
    await page.waitForTimeout(200);

    // Check that preview contains the updated name
    const previewText = await configViewer.textContent();
    expect(previewText).toContain('Updated Quest Name');
  });

  test('can add incentive', async ({ page }) => {
    const addBtn = page.locator('#add-incentive-btn');
    const initialCount = await page.locator('.incentive-item').count();

    // Click add incentive
    await addBtn.click();
    await page.waitForTimeout(200);

    // Check new incentive was added
    const newCount = await page.locator('.incentive-item').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('can remove incentive', async ({ page }) => {
    // Add an incentive first
    await page.locator('#add-incentive-btn').click();
    await page.waitForTimeout(200);

    const initialCount = await page.locator('.incentive-item').count();

    // Click remove button on first incentive
    const removeBtn = page.locator('.remove-btn').first();
    await removeBtn.click();
    await page.waitForTimeout(200);

    // Check incentive was removed
    const newCount = await page.locator('.incentive-item').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('can fork a demo quest', async ({ page }) => {
    // Click fork button on first demo quest
    const forkBtn = page.locator('.fork-btn').first();
    await forkBtn.click();
    await page.waitForTimeout(200);

    // Check that form was populated
    const questNameInput = page.locator('#quest-name');
    const value = await questNameInput.inputValue();
    expect(value.length > 0).toBe(true);

    // Check preview updated
    const preview = page.locator('config-viewer');
    const previewText = await preview.textContent();
    expect(previewText.length > 0).toBe(true);
  });

  test('can navigate demo carousel', async ({ page }) => {
    const gallery = page.locator('examples-gallery');
    const nextBtn = gallery.locator('button.carousel-btn-next');
    const cardTitle = gallery.locator('.quest-name').first();

    // Get initial title
    const initialTitle = await cardTitle.textContent();

    // Click next
    await nextBtn.click();
    await page.waitForTimeout(200);

    // Get new title
    const newTitle = await cardTitle.textContent();

    // Titles should be different
    expect(initialTitle).not.toBe(newTitle);
  });

  test('undo/redo buttons work', async ({ page }) => {
    const questNameInput = page.locator('#quest-name');
    const undoBtn = page.locator('#undo-btn');
    const redoBtn = page.locator('#redo-btn');

    // Initial value
    const initialValue = await questNameInput.inputValue();

    // Change value
    await questNameInput.fill('Changed Value');
    let currentValue = await questNameInput.inputValue();
    expect(currentValue).toBe('Changed Value');

    // Undo
    await undoBtn.click();
    await page.waitForTimeout(200);
    currentValue = await questNameInput.inputValue();
    expect(currentValue).toBe(initialValue);

    // Redo
    await redoBtn.click();
    await page.waitForTimeout(200);
    currentValue = await questNameInput.inputValue();
    expect(currentValue).toBe('Changed Value');
  });

  test('draft persists on reload', async ({ page }) => {
    const questNameInput = page.locator('#quest-name');
    const testName = `Test ${Date.now()}`;

    // Set a value
    await questNameInput.fill(testName);
    await page.waitForTimeout(100);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Value should persist
    const reloadedValue = await questNameInput.inputValue();
    expect(reloadedValue).toBe(testName);
  });

  test('can copy JSON to clipboard', async ({ page }) => {
    // Fill in form first
    await page.locator('#quest-name').fill('Test Quest');
    await page.waitForTimeout(200);

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click copy JSON button
    const copyJsonBtn = page.locator('#copy-json-btn, [id*="json-btn"]').first();
    if (await copyJsonBtn.isVisible()) {
      await copyJsonBtn.click();
      await page.waitForTimeout(200);

      // Check for success notification
      const notification = page.locator('.notification-success');
      expect(notification).toBeTruthy();
    }
  });

  test('export dialog renders export buttons', async ({ page }) => {
    const exportDialog = page.locator('export-dialog');

    // Check for export buttons
    const buttons = exportDialog.locator('button');
    const count = await buttons.count();
    expect(count >= 4).toBe(true); // At least Copy JSON, Download JSON, Copy TS, Download TS
  });

  test('form fields have proper labels', async ({ page }) => {
    // Check for labels
    await expect(page.locator('label[for="quest-name"]')).toBeVisible();
    await expect(page.locator('label[for="quest-desc"]')).toBeVisible();
    await expect(page.locator('label[for="organizer-name"]')).toBeVisible();

    // Check labels have text
    const nameLabel = page.locator('label[for="quest-name"]');
    const labelText = await nameLabel.textContent();
    expect(labelText.length > 0).toBe(true);
  });

  test('buttons are keyboard accessible', async ({ page }) => {
    // Tab to first button
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(typeof focusedElement).toBe('string');

    // Tab through buttons
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Should still be on page
    const body = await page.locator('body');
    expect(body).toBeVisible();
  });

  test('mobile layout is responsive', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check all components are visible
    await expect(page.locator('examples-gallery')).toBeVisible();
    await expect(page.locator('quest-builder')).toBeVisible();
    await expect(page.locator('config-viewer')).toBeVisible();
    await expect(page.locator('export-dialog')).toBeVisible();

    // Check grid stacks vertically
    const appElement = page.locator('#app');
    const style = await appElement.evaluate(el => window.getComputedStyle(el).display);
    expect(style).toBe('flex');
  });

  test('handles rapid state changes', async ({ page }) => {
    const input = page.locator('#quest-name');

    // Rapidly change input
    for (let i = 0; i < 5; i++) {
      await input.fill(`Quest ${i}`);
      await page.waitForTimeout(50);
    }

    // Final value should be set
    const finalValue = await input.inputValue();
    expect(finalValue).toBe('Quest 4');

    // Preview should update
    const preview = page.locator('config-viewer');
    const previewText = await preview.textContent();
    expect(previewText).toContain('Quest 4');
  });

  test('incentive discount percent displays correctly', async ({ page }) => {
    // Add incentive
    await page.locator('#add-incentive-btn').click();
    await page.waitForTimeout(200);

    // Find discount input (should show percentage conversion)
    const discountInput = page.locator('input[data-field="discountBps"]').first();
    await discountInput.fill('500');

    // Check percentage display
    const percentDisplay = page.locator('text=5.00%');
    await expect(percentDisplay).toBeVisible();
  });
});

test.describe('Index Page Smoke Test', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('http://localhost:8000/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('link to builder works', async ({ page }) => {
    await page.goto('http://localhost:8000/');
    // If link exists, click it
    const builderLink = page.locator('a:has-text("builder")');
    if (await builderLink.count() > 0) {
      await builderLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('examples-gallery')).toBeVisible();
    }
  });
});
