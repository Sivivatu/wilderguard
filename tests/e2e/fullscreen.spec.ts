import { expect, test, type Page } from '@playwright/test';

async function mockFullscreen(page: Page, mode: 'supported' | 'unsupported' | 'rejected' | 'noop' | 'installed' | 'native') {
  await page.addInitScript(mode => {
    let active: Element | null = null;
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => mode !== 'unsupported' });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => active });
    HTMLElement.prototype.requestFullscreen = async () => {
      if (mode === 'rejected') throw new Error('Fullscreen not permitted by this WebView.');
      if (mode === 'noop') return;
      active = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    document.exitFullscreen = async () => {
      active = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    if (mode === 'installed') {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => query === '(display-mode: standalone)' ? { ...original(query), matches: true } : original(query);
    }
    if (mode === 'native') {
      const host = window as unknown as { androidBridge?: { postMessage: () => void } };
      host.androidBridge = { postMessage: () => undefined };
    }
  }, mode);
}

test('fullscreen makes a phone battle fill the browser screen and exits cleanly', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await mockFullscreen(page, 'supported');
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
  const button = page.locator('#fullscreen');
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Exit full screen');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await expect(page.locator('html')).toHaveClass(/battle-focus/);
  const bounds = (await button.boundingBox())!;
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(740);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(360);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('html')).not.toHaveClass(/battle-focus/);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
});

for (const mode of ['unsupported', 'installed', 'native'] as const) {
  test(`an ${mode} host has no ineffective fullscreen button`, async ({ page }) => {
    await mockFullscreen(page, mode);
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
    await expect(page.locator('#fullscreen')).toBeHidden();
    if (mode !== 'unsupported') await expect(page.locator('html')).toHaveClass(/battle-focus/);
  });
}

for (const mode of ['rejected', 'noop'] as const) {
  test(`a ${mode} fullscreen request reports the problem and removes the control`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await mockFullscreen(page, mode);
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-artwork', 'ready');
    await page.locator('#fullscreen').click();
    await expect(page.locator('#toast')).toContainText('Full screen is unavailable');
    await expect(page.locator('#fullscreen')).toBeHidden();
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    expect(pageErrors).toEqual([]);
  });
}
