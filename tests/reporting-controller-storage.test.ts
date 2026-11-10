import { afterEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createReportingController } from '../src/error-reporting';
import { clearReportingCaches, REPORTING_DATABASE } from '../src/reporting-storage';

const config = { dsn: 'https://abc@o123.ingest.de.sentry.io/456', environment: 'beta', release: 'com.wilderguard.game.beta@0.1.0-beta.8+8', dist: '8', policy: 'automatic' } as const;
afterEach(() => vi.unstubAllGlobals());

it('deletes a real queued report on opt-out before a pending SDK can load', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(REPORTING_DATABASE);
    request.onupgradeneeded = () => request.result.createObjectStore('queue');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  await new Promise<void>(resolve => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').put('private diagnostic', 1);
    tx.oncomplete = () => resolve();
  });
  const preferences = new Map([['wilderguard-campaign-v1', 'saved progress']]);
  const storage = { getItem: (key: string) => preferences.get(key) ?? null, setItem: (key: string, value: string) => { preferences.set(key, value); } };
  const client = { start: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
  let finishLoad!: (value: typeof client) => void;
  const reporting = createReportingController(config, storage, () => new Promise(resolve => { finishLoad = resolve; }), clearReportingCaches);
  const loading = reporting.start();
  await reporting.setEnabled(false);
  const count = await new Promise<number>(resolve => {
    const request = db.transaction('queue').objectStore('queue').count();
    request.onsuccess = () => resolve(request.result);
  });
  expect(count).toBe(0);
  expect(preferences.get('wilderguard-campaign-v1')).toBe('saved progress');
  expect(preferences.get('wilderguard-error-reporting-v1')).toBe('off');
  finishLoad(client);
  await loading;
  expect(client.start).not.toHaveBeenCalled();
  db.close();
});
