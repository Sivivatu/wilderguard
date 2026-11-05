import { test, expect } from '@playwright/test';

test('the approved club, axe, captain and thrower sprites all appear in a real wave', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem('wilderguard-campaign-v1', JSON.stringify({
      version: 1, regionIndex: 0, diamonds: 300, lives: 20, wave: 4, kills: 0,
      towers: [{ id: 'tower-2', slotId: 2, type: 'archer', level: 1 }],
      inventory: { meteor: 1, freeze: 2, heal: 1 },
    }));
    const tracked = window as unknown as { orcDraws: string[] };
    tracked.orcDraws = [];
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, image: CanvasImageSource, ...args: number[]) {
      if (image instanceof HTMLImageElement && image.src.includes('orc-')) {
        if (!tracked.orcDraws.includes(image.src)) tracked.orcDraws.push(image.src);
        if (this.imageSmoothingEnabled) throw new Error('Orc artwork must keep crisp pixels');
      }
      return Reflect.apply(original, this, [image, ...args]);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
  await page.locator('#start-wave').click();
  for (let i = 0; i < 6; i += 1) await page.clock.runFor(5000);
  const drawn = await page.evaluate(() => (window as unknown as { orcDraws: string[] }).orcDraws);
  for (const kind of ['clubber', 'axeman', 'chieftain', 'thrower']) {
    expect(drawn.some(url => url.includes(`orc-${kind}`))).toBe(true);
  }
  await page.screenshot({ path: 'artifacts/orc-battle-tablet.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('an artwork loading failure prevents invisible enemies from entering battle', async ({ page }) => {
  await page.route('**/assets/orc-*.png', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'error');
  await expect(page.locator('#start-wave')).toBeDisabled();
  await expect(page.locator('#map-status')).toContainText('Orc artwork could not load');
});
