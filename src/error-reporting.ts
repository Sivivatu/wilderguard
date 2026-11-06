import { REPORTING_PREFERENCE_KEY, type ReportingConfig } from './error-policy';

type ReportingClient = { start(config: ReportingConfig, isAllowed: () => boolean): Promise<void>; stop(): Promise<void> };
type PreferenceStore = Pick<Storage, 'getItem' | 'setItem'>;
export function createReportingController(config: ReportingConfig | null, storage: PreferenceStore, load: () => Promise<ReportingClient>, prepareEnable: () => Promise<void> = async () => {}) {
  let preference: string | null = null;
  let hasStorage = true;
  try { preference = storage.getItem(REPORTING_PREFERENCE_KEY); } catch { hasStorage = false; }
  let allowed = Boolean(config && hasStorage && preference !== 'off');
  let failed = !hasStorage;
  let generation = 0;
  let client: ReportingClient | undefined;
  let pending: Promise<void> | undefined;
  let stopping: Promise<void> = Promise.resolve();
  const isEnabled = () => allowed;
  const start = (): Promise<void> => {
    if (!config || !allowed) return Promise.resolve();
    if (pending) return pending;
    const attempt = generation;
    pending = (async () => {
      try {
        const loaded = await load();
        if (!allowed || attempt !== generation) return;
        client = loaded;
        await client.start(config, () => allowed && attempt === generation);
      } catch { if (attempt === generation) { failed = true; allowed = false; } }
    })();
    return pending;
  };
  const setEnabled = async (enabled: boolean) => {
    if (!config) return;
    if (enabled && allowed) { await start(); return; }
    allowed = false;
    const attempt = ++generation;
    pending = undefined;
    try {
      // Keep the durable off preference until old reports have actually been purged.
      if (enabled) {
        await stopping;
        if (attempt !== generation) return;
        await prepareEnable();
      }
      if (attempt !== generation) return;
      storage.setItem(REPORTING_PREFERENCE_KEY, enabled ? 'on' : 'off');
      failed = false;
    } catch { if (attempt !== generation) return; failed = true; }
    if (!enabled || failed) {
      stopping = stopping.then(() => client?.stop()).catch(() => { if (attempt === generation) failed = true; });
      await stopping;
      return;
    }
    allowed = true;
    await start();
  };
  return {
    start, setEnabled, isEnabled,
    markUnavailable: () => { generation++; failed = true; allowed = false; },
    status: () => !config ? 'not-configured' : failed ? 'unavailable' : allowed ? 'on' : 'off',
  };
}
