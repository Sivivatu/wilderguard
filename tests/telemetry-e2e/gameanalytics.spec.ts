import { expect, test } from '@playwright/test';

const posthogEndpoint = 'https://eu.i.posthog.com/i/v0/e/';
const gameAnalyticsEndpoint = 'https://private.example.test/telemetry';

async function buildArcher(page: import('@playwright/test').Page) {
  const canvas = page.locator('#game-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 305 / 1100, y: box.height * 275 / 600 } });
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
}

async function selectProvider(page: import('@playwright/test').Page, provider: 'off' | 'gameanalytics' | 'posthog') {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const selection = page.getByRole('combobox', { name: 'Gameplay statistics' });
  await selection.selectOption(provider);
  await expect(selection).toHaveValue(provider);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
}

test('GameAnalytics summary stays secret-free and switching provider purges its queue', async ({ page }) => {
  test.setTimeout(60000);
  let relayOnline = true;
  const gameAnalyticsRequests: Array<{ body: string; headers: Record<string, string> }> = [];
  const posthogRequests: string[] = [];
  await page.route(gameAnalyticsEndpoint, async route => {
    gameAnalyticsRequests.push({ body: route.request().postData() ?? '', headers: await route.request().allHeaders() });
    if (!relayOnline) { await route.abort('internetdisconnected'); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' });
  });
  await page.route(posthogEndpoint, async route => {
    posthogRequests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Gameplay statistics' })).toHaveValue('off');
  expect(gameAnalyticsRequests).toEqual([]);
  expect(posthogRequests).toEqual([]);
  await page.locator('#gameplay-provider').selectOption('gameanalytics');
  await expect(page.locator('#gameplay-provider')).toHaveValue('gameanalytics');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();

  await buildArcher(page);
  await page.locator('#start-wave').click();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => gameAnalyticsRequests.length).toBeGreaterThan(0);
  const gameAnalyticsStart = JSON.parse(gameAnalyticsRequests[0].body);
  expect(gameAnalyticsStart).toMatchObject({ kind: 'wave_start', context: 'fresh', archer1: 1 });
  expect(gameAnalyticsRequests[0].headers['x-telemetry-epoch']).toBe('family-1');
  expect(gameAnalyticsRequests[0].headers.authorization).toBeUndefined();
  expect(gameAnalyticsRequests[0].body).not.toMatch(/secret|game_key|game_secret|hmac/i);
  expect(posthogRequests).toEqual([]);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v1')!).events.length)).toBe(0);
  relayOnline = false;

  await expect(page.locator('#start-wave')).toBeEnabled({ timeout: 45000 });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => gameAnalyticsRequests.length).toBeGreaterThan(1);
  const gameAnalyticsTerminal = JSON.parse(gameAnalyticsRequests[gameAnalyticsRequests.length - 1].body);
  expect(gameAnalyticsTerminal).toMatchObject({ kind: 'wave_end', outcome: expect.stringMatching(/clear|defeat/) });
  expect(gameAnalyticsTerminal.attemptId).toBe(gameAnalyticsStart.attemptId);
  expect(gameAnalyticsTerminal.activeMs).toBeGreaterThan(0);

  const queuedGA = await page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v1')!).events);
  expect(queuedGA.map((event: { kind: string }) => event.kind)).toEqual(['wave_end']);
  expect(gameAnalyticsRequests[gameAnalyticsRequests.length - 1].headers['x-telemetry-epoch']).toBe('family-1');
  await selectProvider(page, 'posthog');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v1')!).events)).toEqual([]);
  expect(posthogRequests).toEqual([]);
  const gaCountAfterSwitch = gameAnalyticsRequests.length;

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Start a new adventure' }).click();
  await page.getByRole('button', { name: 'Start from the beginning' }).click();
  await buildArcher(page);
  await page.locator('#start-wave').click();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => posthogRequests.length).toBe(1);
  const posthogStart = JSON.parse(posthogRequests[0]);
  expect(posthogStart.event).toBe('wilderguard_wave_start_v1');
  expect(posthogStart.properties).toMatchObject({ kind: 'wave_start', $process_person_profile: false, $geoip_disable: true });
  expect(gameAnalyticsRequests).toHaveLength(gaCountAfterSwitch);

  await selectProvider(page, 'off');
  const postCountAtOptOut = posthogRequests.length;
  await page.waitForTimeout(250);
  expect(posthogRequests).toHaveLength(postCountAtOptOut);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v1')!).events)).toEqual([]);
});
