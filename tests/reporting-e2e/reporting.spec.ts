import { expect, test } from '@playwright/test';

const REPORTING_HOST = 'o123.ingest.de.sentry.io';
test('automatic error-only reports show a notice, scrub data and stop after opt-out', async ({ page }) => {
  const envelopes: string[] = [];
  await page.route(`https://${REPORTING_HOST}/**`, async route => {
    envelopes.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/');
  const notice = page.getByRole('dialog', { name: 'Automatic error reports' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('No saves, names, screenshots or replay');
  await expect(notice.getByRole('button', { name: 'Automatic error reports On' })).toBeVisible();
  await notice.getByRole('button', { name: 'Continue playing' }).click();
  await expect(page.getByRole('heading', { name: 'Stand your ground.' })).toBeVisible();
  // Wait for the optional lazy SDK import, without exposing a production crash trigger.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(entry => /sentry-client.*\.js/.test(entry.name)))).toBe(true);
  await page.evaluate(() => { setTimeout(() => { throw new TypeError('private@example.com token=secret save-data'); }, 0); });
  await expect.poll(() => envelopes.length).toBe(1);
  expect(envelopes[0]).toContain('TypeError');
  expect(envelopes[0]).toContain('com.wilderguard.game.beta@0.1.0-beta.8+8');
  expect(envelopes[0]).not.toMatch(/private@example|secret|save-data|replay_id|transaction"|session"/);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Automatic error reports On' }).click();
  await expect(page.getByRole('button', { name: 'Automatic error reports Off' })).toBeVisible();
  await page.reload();
  await expect(notice).not.toBeVisible();
  await page.evaluate(() => { setTimeout(() => { throw new Error('disabled report'); }, 0); });
  await page.waitForTimeout(500);
  expect(envelopes).toHaveLength(1);
});

test('offline reports stay bounded, survive restart, retry on reconnect and clear on opt-out', async ({ page, context }) => {
  let online = false;
  const delivered: string[] = [];
  await page.route(`https://${REPORTING_HOST}/**`, async route => {
    if (!online) { await route.abort('internetdisconnected'); return; }
    delivered.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue playing' }).click();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(entry => /sentry-client.*\.js/.test(entry.name)))).toBe(true);
  const canvas = page.locator('#game-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 305 / 1100, y: box.height * 275 / 600 } });
  await page.getByRole('button', { name: 'Confirm purchase' }).click();
  await expect(page.locator('#diamond-count')).toHaveText('50');
  const queueSize = () => page.evaluate(async () => {
    if (!(await indexedDB.databases()).some(db => db.name === 'wilderguard-errors-v1')) return 0;
    return new Promise<number>(resolve => {
      const request = indexedDB.open('wilderguard-errors-v1');
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('queue')) { db.close(); resolve(0); return; }
        const count = db.transaction('queue').objectStore('queue').count();
        count.onsuccess = () => { db.close(); resolve(count.result); };
      };
    });
  });
  for (let i = 0; i < 15; i++) {
    await page.evaluate(value => { setTimeout(() => { throw new Error(`offline-${value}`); }, 0); }, i);
  }
  await expect.poll(queueSize).toBe(10);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Stand your ground.' })).toBeVisible();
  await expect(page.locator('#diamond-count')).toHaveText('50');
  expect(await queueSize()).toBeLessThanOrEqual(10);
  online = true;
  await context.setOffline(true); await context.setOffline(false);
  await expect.poll(() => delivered.length, { timeout: 15000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Automatic error reports On' }).click();
  await expect(page.getByRole('button', { name: 'Automatic error reports Off' })).toBeVisible();
  expect(await queueSize()).toBe(0);
});

test('delivers an unhandled error buffered before the lazy SDK finishes loading', async ({ page }) => {
  const envelopes: string[] = [];
  await page.route(`https://${REPORTING_HOST}/**`, async route => {
    envelopes.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('**/sentry-client-*.js', async route => {
    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', { error: new ReferenceError('early-private-save'), message: 'early-private-save' }));
    });
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Automatic error reports' })).toBeVisible();
  await expect.poll(() => envelopes.length).toBe(1);
  expect(envelopes[0]).toContain('ReferenceError');
  expect(envelopes[0]).not.toContain('early-private-save');
});
