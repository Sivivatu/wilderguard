import { expect, test, type Page } from '@playwright/test';

async function seed(page: Page, towers: unknown[], overrides: Record<string, unknown> = {}) {
  await page.setViewportSize({ width: 740, height: 360 });
  await page.addInitScript(({ towers, overrides }) => {
    if (!localStorage.getItem('wilderguard-campaign-v1')) localStorage.setItem('wilderguard-campaign-v1', JSON.stringify({ version: 1, regionIndex: 0, diamonds: 240,
      lives: 20, wave: 0, kills: 0, towers, inventory: { meteor: 1, freeze: 2, heal: 1 }, ...overrides }));
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('battle-focus'));
  }, { towers, overrides });
}

async function tapTower(page: Page) {
  const box = (await page.locator('#game-canvas').boundingBox())!;
  await page.locator('#game-canvas').click({ position: { x: box.width * 305 / 1100, y: box.height * 275 / 600 } });
}

test('damaged tower health is visible and repair requires confirmed diamonds', async ({ page }) => {
  await seed(page, [{ id: 'tower-1', slotId: 1, type: 'archer', level: 1, hp: 90, maxHp: 180 }], { lives: 17 });
  await page.goto('/');
  const health = page.getByRole('meter', { name: 'Castle health' });
  await expect(health).toHaveAttribute('aria-valuenow', '17');
  await expect(health).toContainText('17');
  await expect(health).toContainText('/20');
  await tapTower(page);
  const popover = page.locator('#tower-popover');
  await expect(popover).toContainText('90 / 180 HP');
  await popover.getByRole('button', { name: /Repair/ }).click();
  await expect(page.getByRole('heading', { name: 'Repair Archer tower?' })).toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('240');
  await page.getByRole('button', { name: 'Cancel purchase' }).click();
  await expect(popover).toContainText('90 / 180 HP');
  await popover.getByRole('button', { name: /Repair/ }).click();
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
  await expect(popover).toContainText('180 / 180 HP');
  await expect(page.locator('#diamond-count')).toHaveText('231');
  await expect(popover.getByRole('button', { name: /Repair/ })).toBeDisabled();
  const bounds = (await popover.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(360);
  await page.reload();
  await tapTower(page);
  await expect(popover).toContainText('180 / 180 HP');
});

test('an escaping wave visibly damages the castle and Mending Light restores its meter', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.install();
  await seed(page, [{ id: 'tower-7', slotId: 7, type: 'frost', level: 1 }]);
  await page.goto('/');
  await page.locator('#start-wave').click();
  await expect(page.locator('#map-status')).toContainText('monsters on the march');
  await page.locator('#speed').click();
  for (let step = 0; step < 80 && await page.locator('#lives-count').textContent() === '20'; step += 1) await page.clock.runFor(1000);
  await expect(page.getByRole('meter', { name: 'Castle health' })).not.toHaveAttribute('aria-valuenow', '20');
  await expect(page.locator('#damage-status')).toContainText(/Castle hit/);
  // Let the unprotected wave finish, then heal during the next wave.
  // A screenshot here could let the final enemy escape before the heal click.
  await page.clock.runFor(15000);
  await expect(page.locator('#start-wave')).toBeEnabled();
  await page.locator('#start-wave').click();
  await page.locator('[data-spell="heal"]').click();
  await expect(page.getByRole('meter', { name: 'Castle health' })).toHaveAttribute('aria-valuenow', '20');
  await expect(page.locator('#toast')).toContainText(/Castle restored/);
});

test('a later axe thrower attacks and destroys a tower with visible feedback', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.install();
  await seed(page, [{ id: 'tower-1', slotId: 1, type: 'frost', level: 1, hp: 8, maxHp: 170 }], { regionIndex: 3, wave: 2 });
  await page.goto('/');
  await page.locator('#start-wave').click();
  for (let step = 0; step < 60 && !(await page.locator('#damage-status').textContent())?.includes('destroyed'); step += 1) await page.clock.runFor(1000);
  await expect(page.locator('#damage-status')).toContainText(/Frost tower destroyed/);
  await page.screenshot({ path: 'artifacts/beta6-axe-attack-phone.png' });
  await tapTower(page);
  await expect(page.getByRole('heading', { name: 'Build Archer tower?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel purchase' }).click();
  await page.getByRole('button', { name: 'Tower and ability details' }).click();
  await expect(page.locator('#game-dialog')).toContainText('Axe-throwing orcs');
  await expect(page.locator('#game-dialog')).toContainText(/wave 3/);
});
