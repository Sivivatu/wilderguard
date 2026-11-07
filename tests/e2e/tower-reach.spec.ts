import { expect, test } from '@playwright/test';

test('the Frostfall central Frost tower visibly fires at approaching mobs', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 740, height: 360 });
  await page.clock.install();
  await page.addInitScript(() => {
    Math.random = () => .999999; // Reach must not depend on a successful chill.
    localStorage.setItem('wilderguard-campaign-v1', JSON.stringify({
      version: 1, regionIndex: 3, diamonds: 120, lives: 20, wave: 0, kills: 0,
      towers: [{ id: 'tower-8', slotId: 8, type: 'frost', level: 1 }],
      inventory: { meteor: 1, freeze: 2, heal: 1 },
    }));
    const tracked = window as unknown as { centralFrostShots: number };
    tracked.centralFrostShots = 0;
    const origins = new WeakMap<CanvasRenderingContext2D, { x: number; y: number }>();
    const moveTo = CanvasRenderingContext2D.prototype.moveTo;
    const lineTo = CanvasRenderingContext2D.prototype.lineTo;
    CanvasRenderingContext2D.prototype.moveTo = function (x, y) {
      origins.set(this, { x, y });
      return moveTo.call(this, x, y);
    };
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
      const origin = origins.get(this);
      if (this.canvas.id === 'game-canvas' && this.strokeStyle === '#d4f9f4'
          && origin?.x === 485 && origin.y === 138) tracked.centralFrostShots += 1;
      return lineTo.call(this, x, y);
    };
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('battle-focus'));
  });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
  await page.locator('#start-wave').click();
  await page.clock.runFor(35000);
  expect(await page.evaluate(() => (window as unknown as { centralFrostShots: number }).centralFrostShots)).toBeGreaterThan(1);
  await page.screenshot({ path: 'artifacts/beta9-frostfall-central-tower.png' });
});
