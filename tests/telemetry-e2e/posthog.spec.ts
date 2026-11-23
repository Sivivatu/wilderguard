import { expect, test, type Route } from '@playwright/test';

const corsHeaders = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4175', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Telemetry-Epoch' };
async function preflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: corsHeaders });
  return true;
}

const posthogEndpoint = 'https://eu.i.posthog.com/i/v0/e/';
const gameAnalyticsEndpoint = 'https://private.example.test/telemetry';

async function buildArcher(page: import('@playwright/test').Page) {
  const canvas = page.locator('#game-canvas'); const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 305 / 1100, y: box.height * 275 / 600 } });
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
}

async function setStatistics(page: import('@playwright/test').Page, enabled: boolean) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Gameplay statistics', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', String(!enabled));
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-checked', String(enabled));
  await expect(toggle).toContainText(enabled ? 'On' : 'Off');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
}

test('one On control sends the same anonymous start and outcome to both providers', async ({ page }) => {
  const posthog: string[] = []; const gameanalytics: string[] = [];
  await page.route(posthogEndpoint, async route => {
    if (await preflight(route)) return;
    posthog.push(route.request().postData()!);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders, body: '{"status":"ok"}' });
  });
  await page.route(gameAnalyticsEndpoint, async route => {
    if (await preflight(route)) return;
    gameanalytics.push(route.request().postData()!);
    expect((await route.request().allHeaders())['x-telemetry-epoch']).toBe('family-1');
    await route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders, body: '{"status":"ok"}' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Gameplay statistics', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false'); await expect(toggle).toContainText('Off');
  await expect(page.getByRole('combobox', { name: 'Gameplay statistics' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('both PostHog and GameAnalytics');
  await expect(page.getByRole('dialog')).toContainText('network address');
  await expect(page.locator('#toggle-error-reporting')).toBeVisible();
  expect(posthog).toEqual([]); expect(gameanalytics).toEqual([]);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await setStatistics(page, true); await buildArcher(page); await page.locator('#start-wave').click();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => posthog.length).toBe(1); await expect.poll(() => gameanalytics.length).toBe(1);
  const phStart = JSON.parse(posthog[0]); const gaStart = JSON.parse(gameanalytics[0]);
  expect(phStart.event).toBe('wilderguard_wave_start_v1');
  expect(phStart.properties).toMatchObject({ kind: 'wave_start', context: 'fresh', archer1: 1, $process_person_profile: false, $geoip_disable: true });
  expect(phStart.uuid).toBe(gaStart.id); expect(phStart.distinct_id).toBe(gaStart.runId);
  expect(phStart.properties.attemptId).toBe(gaStart.attemptId);
  expect(gaStart).toMatchObject({ kind: 'wave_start', context: 'fresh', archer1: 1 });
  expect(gameanalytics[0]).not.toMatch(/secret|game_key|game_secret|hmac/i);
  expect(JSON.stringify(phStart)).not.toMatch(/email|name|save|touch|replay|device|latitude/);

  await page.getByRole('button', { name: 'Pause game' }).click(); const pausedAt = Date.now();
  await page.waitForTimeout(1200); await page.evaluate(() => window.dispatchEvent(new Event('online')));
  expect(posthog).toHaveLength(1); expect(gameanalytics).toHaveLength(1);
  await page.getByRole('button', { name: 'Resume adventure' }).click();
  await expect(page.locator('#start-wave')).toBeEnabled({ timeout: 45000 });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => posthog.length).toBe(2); await expect.poll(() => gameanalytics.length).toBe(2);
  const phEnd = JSON.parse(posthog[1]); const gaEnd = JSON.parse(gameanalytics[1]);
  expect(phEnd.event).toBe('wilderguard_wave_end_v1'); expect(phEnd.uuid).toBe(gaEnd.id);
  expect(gaEnd).toMatchObject({ kind: 'wave_end', outcome: expect.stringMatching(/clear|defeat/), attemptId: gaStart.attemptId });
  expect(phEnd.properties.activeMs).toBeLessThan(Date.now() - pausedAt - 700);
  expect(phEnd.properties).toHaveProperty('earned'); expect(phEnd.properties).toHaveProperty('spent'); expect(phEnd.properties).toHaveProperty('slowFrames');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v2')!).entries.length)).toBe(0);

  const savedDiamonds = await page.locator('#diamond-count').textContent(); await page.reload();
  await expect(page.locator('#diamond-count')).toHaveText(savedDiamonds!);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Gameplay statistics', exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(posthog).toHaveLength(2); expect(gameanalytics).toHaveLength(2);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await setStatistics(page, false); await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Gameplay statistics', exact: true })).toHaveAttribute('aria-checked', 'false');
  expect(posthog).toHaveLength(2); expect(gameanalytics).toHaveLength(2);
});
