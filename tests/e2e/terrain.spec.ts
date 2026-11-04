import { test, expect } from '@playwright/test';

const regions = ['greenfields', 'woods', 'sunstone', 'frostfall', 'hollow-crown'];

test('all five regions draw their own approved terrain without page errors', async ({ browser }) => {
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 780 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(index => {
      localStorage.setItem('wilderguard-campaign-v1', JSON.stringify({
        version: 1, regionIndex: index, diamonds: 120, lives: 20, wave: 0, kills: 0,
        towers: [], inventory: { meteor: 1, freeze: 2, heal: 1 },
      }));
      const tracked = window as unknown as { terrainDraws: string[] };
      tracked.terrainDraws = [];
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, image: CanvasImageSource, ...args: number[]) {
        if (image instanceof HTMLImageElement && image.src.includes('terrain-')) tracked.terrainDraws.push(image.src);
        return Reflect.apply(original, this, [image, ...args]);
      } as typeof original;
    }, regionIndex);
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
    await expect.poll(() => page.evaluate(() => (window as unknown as { terrainDraws: string[] }).terrainDraws)).toEqual([expect.stringContaining(`terrain-${regions[regionIndex]}`)]);
    await page.screenshot({ path: `artifacts/region-${regionIndex + 1}.png`, fullPage: true });
    expect(errors).toEqual([]);
    await context.close();
  }
});

test('missing terrain blocks wave start and explains how to recover', async ({ page }) => {
  await page.route('**/assets/terrain-*.webp', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'error');
  await expect(page.locator('#start-wave')).toBeDisabled();
  await expect(page.locator('#map-status')).toContainText('Terrain artwork could not load');
});
