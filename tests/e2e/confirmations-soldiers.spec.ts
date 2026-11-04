import { test, expect, type Page } from '@playwright/test';

const SAVE_KEY = 'wilderguard-campaign-v1';

async function seedCampaign(page: Page, towers: unknown[] = [], diamonds = 240) {
  await page.addInitScript(({ saveKey, savedTowers, savedDiamonds }) => {
    localStorage.setItem(saveKey, JSON.stringify({
      version: 1, regionIndex: 0, diamonds: savedDiamonds, lives: 20, wave: 0, kills: 0,
      towers: savedTowers, inventory: { meteor: 1, freeze: 2, heal: 1 },
    }));
  }, { saveKey: SAVE_KEY, savedTowers: towers, savedDiamonds: diamonds });
}

async function tapSlot(page: Page, x = 305, y = 275) {
  const canvas = page.locator('#game-canvas');
  const bounds = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: bounds.width * x / 1100, y: bounds.height * y / 600 } });
}

test('building and upgrading wait for an explicit purchase confirmation', async ({ page }) => {
  await seedCampaign(page, [], 120);
  await page.goto('/');

  await tapSlot(page);
  const buildDialog = page.getByRole('dialog');
  await expect(buildDialog.getByRole('heading', { name: 'Build Archer tower?' })).toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('120');
  await buildDialog.getByRole('button', { name: 'Cancel purchase' }).click();
  await expect(page.locator('#diamond-count')).toHaveText('120');
  await expect(page.locator('#tower-popover')).toBeHidden();

  await tapSlot(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#diamond-count')).toHaveText('120');
  await expect(page.locator('#tower-popover')).toBeHidden();

  await tapSlot(page);
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
  await expect(page.locator('#diamond-count')).toHaveText('50');
  await expect(page.locator('#tower-popover')).toBeVisible();

  await page.locator('#tower-popover').getByRole('button', { name: /Upgrade/ }).click();
  const upgradeDialog = page.getByRole('dialog');
  await expect(upgradeDialog.getByRole('heading', { name: 'Upgrade Archer tower?' })).toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('50');
  await upgradeDialog.getByRole('button', { name: 'Confirm purchase' }).click();
  await expect(page.locator('#diamond-count')).toHaveText('1');
  await expect(page.locator('#tower-popover')).toContainText('LEVEL 2');
});

test('a purchase dialog pauses a wave and restores its previous running state', async ({ page }) => {
  await seedCampaign(page, [{ id: 'tower-1', slotId: 1, type: 'archer', level: 1 }], 240);
  await page.goto('/');
  await page.locator('#start-wave').click();

  await tapSlot(page, 165, 205);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Build Archer tower?' })).toBeVisible();
  await expect(page.locator('#map-status')).toHaveText('Adventure paused');
  await dialog.getByRole('button', { name: 'Cancel purchase' }).click();
  await expect(page.locator('#map-status')).toContainText('monsters on the march');
});

test('soldiers can be trained separately and deployed for diamonds during a wave', async ({ page }) => {
  await seedCampaign(page, [{ id: 'tower-1', slotId: 1, type: 'archer', level: 1 }], 240);
  await page.goto('/');
  await tapSlot(page);

  await page.locator('#tower-popover').getByRole('button', { name: 'Soldiers' }).click();
  const soldiers = page.getByRole('dialog');
  await expect(soldiers.getByRole('heading', { name: 'Tower soldiers' })).toBeVisible();
  await expect(soldiers.locator('[data-action="deploy-soldiers"]')).toBeDisabled();
  await soldiers.locator('[data-action="train-soldiers"]').click();
  await expect(page.getByRole('heading', { name: 'Train soldiers?' })).toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('240');
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
  await expect(page.locator('#diamond-count')).toHaveText('205');
  await expect(soldiers).toContainText(/level 2/i);
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.locator('#start-wave').click();
  await tapSlot(page);
  await page.locator('#tower-popover').getByRole('button', { name: 'Soldiers' }).click();
  await expect(page.getByRole('dialog').locator('[data-action="deploy-soldiers"]')).toBeEnabled();
  await page.getByRole('dialog').locator('[data-action="deploy-soldiers"]').click();
  await expect(page.getByRole('heading', { name: 'Deploy soldiers?' })).toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('205');
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
  await expect(page.locator('#diamond-count')).toHaveText('175');
  await expect(page.locator('#game-dialog')).toContainText(/2 soldiers/i);
});

test('final-wave victory explains surviving soldiers’ refunds', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 740, height: 360 });
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('wilderguard-campaign-v1', JSON.stringify({
    version: 1, regionIndex: 0, diamonds: 300, lives: 20, wave: 4, kills: 0,
    towers: [{ id: 'tower-2', slotId: 2, type: 'archer', level: 3 }, { id: 'tower-7', slotId: 7, type: 'archer', level: 1 }],
    inventory: { meteor: 1, freeze: 2, heal: 1 },
  })));
  await page.goto('/');
  await page.evaluate(() => document.documentElement.classList.add('battle-focus'));
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
  await page.locator('#start-wave').click();
  // Send a reserve squad from the rear as the last orc approaches the front defenses.
  await page.clock.runFor(18000);
  await tapSlot(page, 920, 500);
  await page.locator('#tower-popover').getByRole('button', { name: 'Soldiers' }).click();
  await page.getByRole('dialog').locator('[data-action="deploy-soldiers"]').click();
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  for (let step = 0; step < 6 && !(await page.locator('#result-overlay').isVisible()); step += 1) await page.clock.runFor(10000);
  await expect(page.locator('#result-overlay')).toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('560');
  await expect(page.locator('#result-overlay')).toContainText('30 diamonds refunded for surviving soldiers');
  const map = (await page.locator('.map-container').boundingBox())!;
  const action = (await page.locator('#result-overlay .primary-button').boundingBox())!;
  expect(action.y).toBeGreaterThanOrEqual(map.y);
  expect(action.y + action.height).toBeLessThanOrEqual(map.y + map.height);
});
