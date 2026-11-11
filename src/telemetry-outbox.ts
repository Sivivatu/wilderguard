import { telemetryEventSchema, type TelemetryAdapter, type TelemetryEvent, type TelemetryStorage } from './telemetry-contract';
export const MAX_EVENTS = 64;
export const RETENTION_MS = 48 * 60 * 60 * 1000;
const KEY = 'wilderguard-telemetry-outbox-v1';
const MAX_STORAGE_CHARS = 128_000;
const REQUEST_TIMEOUT_MS = 8_000;
interface Options { storage: TelemetryStorage; scope: string; send: TelemetryAdapter['send']; now?: () => number }
export function createTelemetryOutbox({ storage, scope, send, now = Date.now }: Options) {
  let events: TelemetryEvent[] = [];
  let available = true;
  let sending = false;
  let generation = 0;
  let activeRequest: AbortController | null = null;
  const fresh = (event: TelemetryEvent) => event.at <= now() && event.at > now() - RETENTION_MS;
  function persist(): boolean {
    try { storage.setItem(KEY, JSON.stringify({ scope, events })); return true; }
    catch {
      available = false; events = [];
      try { storage.removeItem?.(KEY); } catch { /* UI reports revocation/storage failure. */ }
      return false;
    }
  }
  try {
    const raw = storage.getItem(KEY);
    if (raw && raw.length <= MAX_STORAGE_CHARS) {
      const saved = JSON.parse(raw);
      if (saved.scope === scope && Array.isArray(saved.events)) {
        events = saved.events.slice(-MAX_EVENTS).flatMap((value: unknown) => {
          const parsed = telemetryEventSchema.safeParse(value);
          return parsed.success && fresh(parsed.data) ? [parsed.data] : [];
        });
      }
    }
  } catch { events = []; }
  // Rewrites on scope mismatch: switching back can never recover another provider's events.
  persist();
  function purge() {
    generation += 1; activeRequest?.abort(); events = []; persist();
  }
  async function flush(): Promise<void> {
    if (sending || !available) return;
    sending = true;
    const epoch = generation;
    try {
      events = events.filter(fresh);
      if (!persist()) return;
      // A flush only handles the initial bounded snapshot, never an unbounded live stream.
      for (const event of [...events]) {
        if (epoch !== generation || !available) break;
        const request = new AbortController(); activeRequest = request;
        const timer = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
        let result;
        try { result = await send(event, request.signal); }
        catch { break; }
        finally { clearTimeout(timer); if (activeRequest === request) activeRequest = null; }
        if (epoch !== generation || result === 'retry') break;
        events = events.filter(item => item.id !== event.id);
        if (!persist()) break;
      }
    } finally { sending = false; }
  }
  return {
    record(value: TelemetryEvent) {
      if (!available) return;
      const parsed = telemetryEventSchema.safeParse(value);
      if (!parsed.success || !fresh(parsed.data) || events.some(event => event.id === parsed.data.id)) return;
      events = [...events.filter(fresh), parsed.data].slice(-MAX_EVENTS); persist();
    },
    flush, purge, size: () => events.length, available: () => available,
  };
}
