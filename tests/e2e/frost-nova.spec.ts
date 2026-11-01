import { expect, test } from '@playwright/test';

test('a level 3 Frost kill draws an icy burst and the guide explains contagion', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem('wilderguard-campaign-v1', JSON.stringify({
      version: 1, regionIndex: 0, diamonds: 120, lives: 20, wave: 0, kills: 0,
      towers: [{ id: 'tower-1', slotId: 1, type: 'frost', level: 3 }],
      inventory: { meteor: 1, freeze: 2, heal: 1 },
    }));
    const tracked = window as unknown as { frostBurstDraws: number };
    tracked.frostBurstDraws = 0;
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      if (this.canvas.id === 'game-canvas' && this.strokeStyle === '#a9edff') tracked.frostBurstDraws += 1;
      return Reflect.apply(stroke, this, args);
    } as typeof stroke;
  });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
  await page.getByRole('button', { name: 'Tower and ability details', exact: true }).click();
  await expect(page.locator('#game-dialog')).toContainText('Frost nova');
  await expect(page.locator('#game-dialog')).toContainText('90');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.locator('#start-wave').click();
  await page.clock.runFor(12000);
  expect(await page.evaluate(() => (window as unknown as { frostBurstDraws: number }).frostBurstDraws)).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/frost-nova-battle.png' });
  expect(errors).toEqual([]);
});
