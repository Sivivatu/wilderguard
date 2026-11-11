import { Capacitor, registerPlugin } from '@capacitor/core';

export const REPORTING_DATABASE = 'wilderguard-errors-v1';
export const nativeReporting = registerPlugin<{ disableReporting(): Promise<void>; fetchNativeRelease(): Promise<{ id: string; version: string; build: string }> }>('SentryCapacitor');

export async function clearBrowserReports(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(REPORTING_DATABASE);
    let isAbsent = false;
    request.onupgradeneeded = () => { isAbsent = true; request.transaction?.abort(); };
    request.onerror = () => isAbsent ? resolve() : reject(new Error('Error report cache unavailable'));
    request.onsuccess = () => {
      const db = request.result;
      try {
        if (!db.objectStoreNames.contains('queue')) { db.close(); resolve(); return; }
        const transaction = db.transaction('queue', 'readwrite');
        transaction.objectStore('queue').clear();
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = transaction.onabort = () => { db.close(); reject(new Error('Error report cache could not be cleared')); };
      } catch { db.close(); reject(new Error('Error report cache unavailable')); }
    };
  });
}

export async function clearReportingCaches(): Promise<void> {
  const results = await Promise.allSettled([
    clearBrowserReports(),
    Capacitor.isNativePlatform() ? nativeReporting.disableReporting() : Promise.resolve(),
  ]);
  if (results.some(result => result.status === 'rejected')) throw new Error('Error report cache could not be cleared');
}
