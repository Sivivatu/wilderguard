import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
const mocks = vi.hoisted(() => ({ native: vi.fn(() => false), disable: vi.fn(async () => {}) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native }, registerPlugin: () => ({ disableReporting: mocks.disable }) }));
import { clearBrowserReports, clearReportingCaches, REPORTING_DATABASE } from '../src/reporting-storage';
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); mocks.native.mockReturnValue(false); mocks.disable.mockClear(); });
afterEach(() => vi.unstubAllGlobals());
it('clears diagnostic envelopes without touching campaign storage', async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(REPORTING_DATABASE);
    request.onupgradeneeded = () => request.result.createObjectStore('queue');
    request.onsuccess = () => resolve(request.result); request.onerror = reject;
  });
  await new Promise<void>(resolve => {
    const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').put('private', 1); tx.oncomplete = () => resolve();
  });
  await clearBrowserReports();
  const count = await new Promise<number>(resolve => { const req = db.transaction('queue').objectStore('queue').count(); req.onsuccess = () => resolve(req.result); });
  expect(count).toBe(0); db.close();
});
it('does not create a new diagnostics database when none exists', async () => {
  await clearBrowserReports();
  expect(await indexedDB.databases()).toEqual([]);
});
it('revokes native reporting and tolerates unavailable storage', async () => {
  mocks.native.mockReturnValue(true);
  vi.stubGlobal('indexedDB', undefined);
  await clearReportingCaches();
  expect(mocks.disable).toHaveBeenCalledOnce();
});
it('fails closed if native cache removal fails', async () => {
  mocks.native.mockReturnValue(true);
  mocks.disable.mockRejectedValueOnce(new Error('cache locked'));
  await expect(clearReportingCaches()).rejects.toThrow('could not be cleared');
});
