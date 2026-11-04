import { test, expect, type Page } from '@playwright/test';

const phoneLandscapes = [
  { width: 844, height: 390 },
  { width: 740, height: 360 },
  { width: 667, height: 375 },
];

async function enterBattleFocus(page: Page) {
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
  await page.getByRole('button', { name: 'Toggle full screen' }).click();
  await expect(page.locator('html')).toHaveClass(/battle-focus/);
}

async function confirmPurchaseIfShown(page: Page) {
  const confirm = page.getByRole('button', { name: 'Confirm purchase' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

test('phone landscape keeps a large battlefield and reachable battle controls', async ({ browser }) => {
  for (const viewport of phoneLandscapes) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await enterBattleFocus(page);

    const statusSize = await page.locator('#map-status').evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    const waveLabelSize = await page.locator('.wave-label').evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    const waveCountSize = await page.locator('#wave-count').evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(statusSize, `map status text should be readable at ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(11);
    expect(waveLabelSize, `wave label should be readable at ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(12);
    expect(waveCountSize, `wave count should be readable at ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(12);

    const map = await page.locator('.map-container').boundingBox();
    expect(map, `${viewport.width}x${viewport.height} battlefield should be visible`).not.toBeNull();
    expect(map!.height, `${viewport.width}x${viewport.height} battlefield height`).toBeGreaterThanOrEqual(viewport.height * 0.58);

    if (viewport.width === 844) {
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.screenshot({ path: 'artifacts/phone-landscape.png' });
    }
    for (const control of await page.locator('.tower-card, #start-wave, .spell-button, .defense-help').all()) {
      const selector = await control.getAttribute('class');
      const bounds = await control.boundingBox();
      expect(bounds, `${selector} should be visible at ${viewport.width}x${viewport.height}`).not.toBeNull();
      expect(bounds!.y + bounds!.height, `${selector} should fit at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(viewport.height);
      expect(bounds!.x, `${selector} should not clip on left`).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, `${selector} should not clip on right`).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.height, `${selector} should remain easy to tap`).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (viewport.width === 740) {
      const canvas = page.locator('#game-canvas');
      const canvasBox = (await canvas.boundingBox())!;
      await canvas.tap({ position: { x: canvasBox.width * 305 / 1100, y: canvasBox.height * 275 / 600 } });
      await confirmPurchaseIfShown(page);
      const popover = page.locator('#tower-popover');
      await expect(popover).toBeVisible();
      const popoverBox = (await popover.boundingBox())!;
      expect(popoverBox.x).toBeGreaterThanOrEqual(map!.x);
      expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(map!.x + map!.width);
      expect(popoverBox.y + popoverBox.height).toBeLessThanOrEqual(map!.y + map!.height);
      await expect(popover.getByRole('button', { name: /Upgrade/ })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await context.close();
  }
});

test('battle result action stays visible on a short landscape phone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: phoneLandscapes[1], hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('wilderguard-campaign-v1', JSON.stringify({
      version: 1, regionIndex: 0, diamonds: 240, lives: 20, wave: 5, kills: 24,
      towers: [], inventory: { meteor: 1, freeze: 2, heal: 1 },
    }));
  });
  await page.goto('/');
  await expect(page.locator('#result-overlay')).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add('battle-focus'));
  await page.waitForTimeout(50);
  const action = page.locator('#result-overlay .primary-button');
  await expect(action).toBeVisible();
  const bounds = (await action.boundingBox())!;
  const mapBounds = (await page.locator('.map-container').boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width);
  expect(bounds.y).toBeGreaterThanOrEqual(mapBounds.y);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(phoneLandscapes[1].height);
  await action.click();
  await expect(page.locator('#result-overlay')).toBeHidden();
  await context.close();
});

test('opening the guide during a wave pauses, and closing restores prior pause state', async ({ browser }) => {
  const context = await browser.newContext({ viewport: phoneLandscapes[1], hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await enterBattleFocus(page);
  const canvas = page.locator('#game-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.tap({ position: { x: box.width * 305 / 1100, y: box.height * 275 / 600 } });
  await confirmPurchaseIfShown(page);
  await page.locator('#start-wave').click();
  const guide = page.getByRole('button', { name: 'Tower and ability details' });
  await guide.click();
  await expect(page.locator('#map-status')).toHaveText('Adventure paused');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('#map-status')).toContainText('monsters on the march');

  await page.getByRole('button', { name: 'Pause game' }).click();
  await guide.click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('heading', { name: 'A moment to breathe.' })).toBeVisible();
  await context.close();
});

test('Starfall details reflect the selected campaign region', async ({ page }) => {
  await page.setViewportSize(phoneLandscapes[1]);
  await page.addInitScript(() => localStorage.setItem('wilderguard-campaign-v1', JSON.stringify({
    version: 1, regionIndex: 3, diamonds: 120, lives: 20, wave: 0, kills: 0,
    towers: [], inventory: { meteor: 1, freeze: 2, heal: 1 },
  })));
  await enterBattleFocus(page);
  await page.getByRole('button', { name: 'Tower and ability details' }).click();
  await expect(page.locator('#game-dialog')).toContainText('192.5 damage');
  await page.getByRole('button', { name: 'Close dialog' }).click();
});

test('portrait battle focus keeps the help and spell controls on screen', async ({ browser }) => {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await enterBattleFocus(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  for (const control of await page.locator('.defense-help, .spell-button').all()) {
    const bounds = (await control.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  }
  await context.close();
});

test('tower and ability details are touch-accessible and preserve resources', async ({ page }) => {
  await page.setViewportSize(phoneLandscapes[1]);
  await enterBattleFocus(page);
  const diamonds = await page.locator('#diamond-count').textContent();
  const inventory = await Promise.all(['meteor', 'freeze', 'heal'].map(spell => page.locator(`#spell-${spell}`).textContent()));

  const details = page.getByRole('button', { name: 'Tower and ability details' });
  await expect(details).toBeVisible();
  await details.click();
  const dialog = page.locator('#game-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/archer/i);
  await expect(dialog).toContainText(/15 damage/i);
  await expect(dialog).toContainText(/0\.7 seconds/i);
  await expect(dialog).toContainText(/frost/i);
  await expect(dialog).toContainText(/50%.*2 seconds/i);
  await expect(dialog).toContainText(/88%.*6 seconds/i);
  await expect(dialog).toContainText(/110 damage/i);
  await expect(dialog).toContainText(/restore 6/i);
  await expect(page.locator('#diamond-count')).toHaveText(diamonds!);
  expect(await Promise.all(['meteor', 'freeze', 'heal'].map(spell => page.locator(`#spell-${spell}`).textContent()))).toEqual(inventory);
  await page.getByRole('button', { name: 'Close dialog' }).click();
});
