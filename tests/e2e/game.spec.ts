import { test, expect } from '@playwright/test';

async function buildAt(page: import('@playwright/test').Page, x: number, y: number) {
  const canvas = page.locator('#game-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * x / 1100, y: box.height * y / 600 } });
  const confirm = page.getByRole('button', { name: 'Confirm purchase' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

async function confirmUpgradeIfShown(page: import('@playwright/test').Page) {
  const confirm = page.getByRole('button', { name: 'Confirm purchase' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

test('build, upgrade, sell and restore a saved defense', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stand your ground.' })).toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('120');
  await buildAt(page, 305, 275);
  await expect(page.locator('#diamond-count')).toHaveText('50');
  await expect(page.locator('#tower-popover')).toBeVisible();
  await page.getByRole('button', { name: /Upgrade · 49/ }).click();
  await confirmUpgradeIfShown(page);
  await expect(page.locator('#diamond-count')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#diamond-count')).toHaveText('1');
  await buildAt(page, 305, 275);
  await expect(page.locator('#tower-popover')).toContainText('LEVEL 2');
  await page.getByRole('button', { name: 'Sell tower for 60 percent refund' }).click();
  await expect(page.locator('#diamond-count')).toHaveText('72');
  expect(errors).toEqual([]);
});

test('play a real wave, pause, cast a spell and receive a reward', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.install();
  await page.goto('/');
  await buildAt(page, 305, 275);
  await page.locator('#start-wave').click();
  await expect(page.locator('#start-wave')).toBeDisabled();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.getByRole('heading', { name: 'A moment to breathe.' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume adventure' }).click();
  await page.locator('[data-spell="freeze"]').click();
  await expect(page.locator('#spell-freeze')).toHaveText('1');
  await page.locator('#speed').click();
  await expect(page.locator('#speed')).toHaveText('2×');
  for (let i = 0; i < 7 && await page.locator('#start-wave').isDisabled(); i += 1) await page.clock.runFor(10000);
  await expect(page.locator('#start-wave')).toBeEnabled();
  await expect(page.locator('#wave-instruction')).toContainText('Wave cleared! +48 diamonds');
  await expect(page.locator('#diamond-count')).toHaveText('98');
  await page.reload();
  await expect(page.locator('#diamond-count')).toHaveText('98');
});

test('help, creator credit, sound and restart work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#game-dialog')).toContainText('Eric, a 7-year-old boy.');
  await page.getByRole('button', { name: 'Gentle game sounds Off' }).click();
  await expect(page.getByRole('button', { name: 'Gentle game sounds On' })).toBeVisible();
  await page.getByRole('button', { name: 'Start a new adventure' }).click();
  await page.getByRole('button', { name: 'Start from the beginning' }).click();
  await expect(page.locator('#game-dialog')).not.toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('120');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.locator('#game-dialog')).toContainText('Build your line of defense');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('#pause-overlay')).not.toBeVisible();
});

test('tablet and phone layouts fit, touch placement works', async ({ browser }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = (await page.locator('#game-canvas').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width * 305 / 1100, box.y + box.height * 275 / 600);
    await page.getByRole('button', { name: 'Confirm purchase' }).click();
    await expect(page.locator('#diamond-count')).toHaveText('50');
    await context.close();
  }
});

test('the installed app shell launches offline after first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
  await expect(page.getByRole('heading', { name: 'Stand your ground.' })).toBeVisible();
  await buildAt(page, 305, 275);
  await expect(page.locator('#diamond-count')).toHaveText('50');
});

test('full screen battle mode keeps controls within a landscape tablet viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle full screen' }).click();
  await expect(page.locator('html')).toHaveClass(/battle-focus/);
  await expect(page.locator('#battle-diamond-count')).toBeVisible();
  const controls = page.locator('.supply-row');
  const box = (await controls.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await buildAt(page, 305, 275);
  await expect(page.locator('#diamond-count')).toHaveText('50');
  await expect(page.locator('#battle-diamond-count')).toHaveText('50');
  await page.getByRole('button', { name: 'Open game menu' }).click();
  await expect(page.getByRole('button', { name: 'Campaign map' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect(page.locator('html')).not.toHaveClass(/battle-focus/);
});
