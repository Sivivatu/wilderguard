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

test('phone landscape keeps a large battlefield and reachable battle controls', async ({ browser }) => {
  for (const viewport of phoneLandscapes) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await enterBattleFocus(page);

    const map = await page.locator('.map-container').boundingBox();
    expect(map, `${viewport.width}x${viewport.height} battlefield should be visible`).not.toBeNull();
    expect(map!.height, `${viewport.width}x${viewport.height} battlefield height`).toBeGreaterThanOrEqual(viewport.height * 0.58);

    for (const control of await page.locator('.tower-card, #start-wave, .spell-button').all()) {
      const selector = await control.getAttribute('class');
      const bounds = await control.boundingBox();
      expect(bounds, `${selector} should be visible at ${viewport.width}x${viewport.height}`).not.toBeNull();
      expect(bounds!.y + bounds!.height, `${selector} should fit at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(phoneLandscapes[1].height);
  await action.click();
  await expect(page.locator('#result-overlay')).toBeHidden();
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
