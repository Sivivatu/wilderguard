import { expect, test, type Route } from '@playwright/test';

const corsHeaders = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4175', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Telemetry-Epoch' };
async function preflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: corsHeaders });
  return true;
}

const endpoints = { posthog: 'https://eu.i.posthog.com/i/v0/e/', gameanalytics: 'https://private.example.test/telemetry' };
type Provider = keyof typeof endpoints;
async function startPausedWave(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Gameplay statistics', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false'); await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  const canvas = page.locator('#game-canvas'); const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 305 / 1100, y: box.height * 275 / 600 } });
  await page.getByRole('button', { name: 'Confirm purchase' }).click(); await page.locator('#start-wave').click();
  await page.getByRole('button', { name: 'Pause game' }).click();
}
const queue = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v2')!).entries);

for (const failing of ['posthog', 'gameanalytics'] as const) {
  test(`${failing} retries after reload without resending the other provider's acknowledgement`, async ({ page }) => {
    const healthy: Provider = failing === 'posthog' ? 'gameanalytics' : 'posthog';
    let recovered = false;
    const requests: Record<Provider, string[]> = { posthog: [], gameanalytics: [] };
    for (const provider of ['posthog', 'gameanalytics'] as const) {
      await page.route(endpoints[provider], async route => {
    if (await preflight(route)) return;
        requests[provider].push(route.request().postData()!);
        await route.fulfill({ status: provider === failing && !recovered ? 503 : 200, contentType: 'application/json', headers: corsHeaders, body: '{}' });
      });
    }
    await page.goto('/'); await startPausedWave(page);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => requests[healthy].length).toBe(1); await expect.poll(() => requests[failing].length).toBeGreaterThan(0);
    await expect.poll(async () => (await queue(page))[0]?.pending).toEqual([failing]);
    const [queued] = await queue(page); const id = queued.event.id;
    const transmittedId = (body: string, provider: Provider) => provider === 'posthog' ? JSON.parse(body).uuid : JSON.parse(body).id;
    expect(transmittedId(requests[healthy][0], healthy)).toBe(id);
    expect(transmittedId(requests[failing][0], failing)).toBe(id);
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Gameplay statistics', exact: true })).toHaveAttribute('aria-checked', 'true');
    expect((await queue(page))[0].event.id).toBe(id);
    recovered = true; await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await queue(page)).length).toBe(0);
    expect(requests[healthy]).toHaveLength(1);
    expect(requests[failing].length).toBeGreaterThanOrEqual(2);
    expect(requests[failing].every(body => transmittedId(body, failing) === id)).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-campaign-v1')!).diamonds)).toBe(50);
  });
}

test('Off purges both pending destinations, cancels delivery, and persists across reload', async ({ page }) => {
  const requests: Record<Provider, string[]> = { posthog: [], gameanalytics: [] };
  for (const provider of ['posthog', 'gameanalytics'] as const) {
    await page.route(endpoints[provider], async route => {
    if (await preflight(route)) return;
      requests[provider].push(route.request().postData()!);
      await route.fulfill({ status: 503, contentType: 'application/json', headers: corsHeaders, body: '{}' });
    });
  }
  await page.goto('/'); await startPausedWave(page);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => requests.posthog.length).toBeGreaterThan(0); await expect.poll(() => requests.gameanalytics.length).toBeGreaterThan(0);
  await expect.poll(async () => (await queue(page))[0]?.pending.length).toBe(2);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Gameplay statistics', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Gameplay statistics', exact: true })).toHaveAttribute('aria-checked', 'false');
  expect(await queue(page)).toEqual([]);
  const counts = { posthog: requests.posthog.length, gameanalytics: requests.gameanalytics.length };
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Gameplay statistics', exact: true })).toHaveAttribute('aria-checked', 'false');
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.waitForTimeout(250);
  expect(await queue(page)).toEqual([]);
  expect(requests.posthog).toHaveLength(counts.posthog); expect(requests.gameanalytics).toHaveLength(counts.gameanalytics);
});
