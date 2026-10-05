import { test, expect } from '@playwright/test';

test('reference artwork never replaces the animated scene, including saved poster preferences', async ({ page }) => {
  const requests = [], errors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('fimken.v1.settings', JSON.stringify({ 'scene-mode': 'artwork', quality: 'balanced' }));
  });
  await page.goto('/?character=debug-goku&debug=1');
  const scene = page.locator('#battle');
  await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 25000 });
  await expect(scene).toBeVisible();
  await expect(page.locator('#illustration')).toHaveCount(0);
  expect(requests.some(url => url.includes('/artwork/'))).toBe(false);
  const progress = await scene.getAttribute('data-progress');
  await expect.poll(() => scene.getAttribute('data-progress')).not.toBe(progress);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('button', { name: 'Practice strikes' })).toBeVisible();
  await expect(page.getByLabel('Training physics')).toBeChecked();
  await expect(page.getByLabel('Scene', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause animation' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.screenshot({ path: 'test-results/restored-3d-scene.png' });
  expect(errors).toEqual([]);
});
