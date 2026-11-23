import { expect, test } from '@playwright/test';

const endpoint = 'https://eu.i.posthog.com/i/v0/e/';

async function buildArcher(page: import('@playwright/test').Page) {
  const canvas = page.locator('#game-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 305 / 1100, y: box.height * 275 / 600 } });
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
}

async function choosePostHog(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Gameplay statistics' })).toHaveValue('off');
  await page.getByRole('combobox', { name: 'Gameplay statistics' }).selectOption('posthog');
  await expect(page.getByRole('combobox', { name: 'Gameplay statistics' })).toHaveValue('posthog');
  await expect(page.getByRole('dialog')).toContainText('PostHog receives your network address');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
}

test('starts off and sends only anonymous allowlisted events after selection', async ({ page }) => {
  const requests: string[] = [];
  await page.route(endpoint, async route => {
    requests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#gameplay-provider')).toHaveValue('off');
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);

  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await choosePostHog(page);
  await buildArcher(page);
  await page.locator('#start-wave').click();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => requests.length).toBe(1);
  const startRequest = JSON.parse(requests[0]);
  expect(startRequest.event).toBe('wilderguard_wave_start_v1');
  expect(startRequest.properties).toMatchObject({
    kind: 'wave_start',
    context: 'fresh',
    archer1: 1,
    $process_person_profile: false,
    $geoip_disable: true,
  });
  expect(startRequest.distinct_id).toBe(startRequest.properties.runId);
  expect(JSON.stringify(startRequest)).not.toMatch(/email|name|save|touch|replay|device|latitude/);

  await page.getByRole('button', { name: 'Pause game' }).click();
  const pausedAt = Date.now();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(200);
  expect(requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Resume adventure' }).click();
  await expect(page.locator('#start-wave')).toBeEnabled({ timeout: 45000 });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => requests.length).toBe(2);
  const terminalRequest = JSON.parse(requests[1]);
  expect(terminalRequest.event).toBe('wilderguard_wave_end_v1');
  expect(terminalRequest.properties).toMatchObject({ kind: 'wave_end', outcome: expect.stringMatching(/clear|defeat/) });
  expect(terminalRequest.properties.attemptId).toBe(startRequest.properties.attemptId);
  expect(terminalRequest.properties.activeMs).toBeLessThan(Date.now() - pausedAt - 700);
  expect(terminalRequest.properties).toHaveProperty('earned');
  expect(terminalRequest.properties).toHaveProperty('spent');
  expect(terminalRequest.properties).toHaveProperty('slowFrames');

  const savedDiamonds = await page.locator('#diamond-count').textContent();
  await page.reload();
  await expect(page.locator('#diamond-count')).toHaveText(savedDiamonds!);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#gameplay-provider')).toHaveValue('posthog');
  expect(requests).toHaveLength(2);

  await page.locator('#gameplay-provider').selectOption('off');
  await expect(page.locator('#gameplay-provider')).toHaveValue('off');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v1')!).events)).toEqual([]);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.waitForTimeout(200);
  expect(requests).toHaveLength(2);
});

test('offline events retain their IDs across reload and drain after reconnect', async ({ page, context }) => {
  let networkOnline = false;
  const requests: string[] = [];
  await page.route(endpoint, async route => {
    if (!networkOnline) { await route.abort('internetdisconnected'); return; }
    requests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await choosePostHog(page);
  await buildArcher(page);
  await page.locator('#start-wave').click();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#gameplay-provider')).toHaveValue('posthog');
  const queue = () => page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v1')!).events);
  const queuedBefore = await queue();
  expect(queuedBefore.length).toBeGreaterThan(0);
  const eventIds = queuedBefore.map((event: { id: string }) => event.id);
  expect(new Set(eventIds).size).toBe(eventIds.length);

  networkOnline = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await expect.poll(async () => (await queue()).length, { timeout: 15000 }).toBe(0);
  const deliveredIds = requests.flatMap(body => JSON.parse(body).uuid ? [JSON.parse(body).uuid] : []);
  expect(deliveredIds).toEqual(expect.arrayContaining(eventIds));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wilderguard-campaign-v1')!).diamonds)).toBe(50);
});
