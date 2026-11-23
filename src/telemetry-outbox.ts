import { z } from 'zod';
import { telemetryEventSchema, type SendResult, type TelemetryEvent, type TelemetryProvider, type TelemetryStorage } from './telemetry-contract';
export const MAX_EVENTS = 64;
export const RETENTION_MS = 48 * 60 * 60 * 1000;
const KEY = 'wilderguard-telemetry-outbox-v2';
const LEGACY_KEY = 'wilderguard-telemetry-outbox-v1';
const MAX_STORAGE_CHARS = 128_000;
const REQUEST_TIMEOUT_MS = 8_000;
const PROVIDERS: TelemetryProvider[] = ['posthog', 'gameanalytics'];
const entrySchema = z.strictObject({ event: telemetryEventSchema,
  pending: z.array(z.enum(['posthog', 'gameanalytics'])).min(1).max(2).refine(items => new Set(items).size === items.length) });
type Entry = z.infer<typeof entrySchema>;
interface Options {
  storage: TelemetryStorage; scope: string;
  send(provider: TelemetryProvider, event: TelemetryEvent, signal: AbortSignal): Promise<SendResult>;
  now?: () => number;
}
export function createTelemetryOutbox({ storage, scope, send, now = Date.now }: Options) {
  let entries: Entry[] = [];
  let available = true;
  let sending = false;
  let generation = 0;
  const activeRequests = new Set<AbortController>();
  const fresh = (event: TelemetryEvent) => event.at <= now() && event.at > now() - RETENTION_MS;
  function remove(key: string) {
    if (storage.removeItem) storage.removeItem(key); else storage.setItem(key, '');
  }
  function failClosed() {
    available = false; entries = []; generation += 1;
    for (const request of activeRequests) request.abort();
    try { remove(KEY); } catch { /* Storage remains unavailable; delivery stays disabled. */ }
  }
  function persist(): boolean {
    if (!available) return false;
    try {
      let raw = JSON.stringify({ version: 2, scope, entries });
      while (raw.length > MAX_STORAGE_CHARS && entries.length) {
        entries = entries.slice(1); raw = JSON.stringify({ version: 2, scope, entries });
      }
      if (raw.length > MAX_STORAGE_CHARS) { failClosed(); return false; }
      storage.setItem(KEY, raw); return true;
    } catch { failClosed(); return false; }
  }
  function restore() {
    let raw: string | null;
    try { remove(LEGACY_KEY); raw = storage.getItem(KEY); }
    catch { failClosed(); return; }
    try {
      const saved = raw && raw.length <= MAX_STORAGE_CHARS ? JSON.parse(raw) : null;
      if (saved?.version === 2 && saved.scope === scope && Array.isArray(saved.entries)) {
        const parsed = saved.entries.slice(-MAX_EVENTS).flatMap((value: unknown) => {
          const result = entrySchema.safeParse(value);
          return result.success && fresh(result.data.event) ? [result.data] : [];
        });
        entries = parsed.filter((entry: Entry, index: number) => parsed.findIndex((item: Entry) => item.event.id === entry.event.id) === index);
      }
    } catch { entries = []; /* Malformed data is erased before any delivery. */ }
    // Rewrites on scope mismatch: changing back cannot recover another project's data.
    persist();
  }
  restore();
  function purge() {
    generation += 1; entries = [];
    for (const request of activeRequests) request.abort();
    persist();
  }
  async function deliver(provider: TelemetryProvider, event: TelemetryEvent): Promise<SendResult> {
    const request = new AbortController(); activeRequests.add(request);
    let onAbort!: () => void;
    const aborted = new Promise<SendResult>(resolve => {
      onAbort = () => resolve('retry'); request.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
    try {
      // Race abort explicitly: an adapter that ignores AbortSignal cannot keep a lane alive.
      return await Promise.race([Promise.resolve().then(() => request.signal.aborted ? 'retry' as const : send(provider, event, request.signal)), aborted]);
    } catch { return 'retry'; }
    finally {
      clearTimeout(timer); request.signal.removeEventListener('abort', onAbort); activeRequests.delete(request);
    }
  }
  async function drain(provider: TelemetryProvider, snapshot: Entry[], epoch: number) {
    for (const entry of snapshot) {
      if (epoch !== generation || !available) break;
      if (!entry.pending.includes(provider) || !entries.some(item => item.event.id === entry.event.id && item.pending.includes(provider))) continue;
      const result = await deliver(provider, entry.event);
      if (epoch !== generation || !available || result === 'retry') break;
      if (result !== 'sent' && result !== 'drop') break;
      // Apply acknowledgements to the current state, including the other lane's progress.
      entries = entries.flatMap(item => {
        if (item.event.id !== entry.event.id) return [item];
        const pending = item.pending.filter(destination => destination !== provider);
        return pending.length ? [{ ...item, pending }] : [];
      });
      if (!persist()) break;
    }
  }
  async function flush(): Promise<void> {
    if (sending || !available) return;
    sending = true;
    try {
      entries = entries.filter(entry => fresh(entry.event));
      if (!persist()) return;
      const snapshot = [...entries]; const epoch = generation;
      await Promise.all(PROVIDERS.map(provider => drain(provider, snapshot, epoch)));
    } finally { sending = false; }
  }
  return {
    record(value: TelemetryEvent) {
      if (!available) return;
      const parsed = telemetryEventSchema.safeParse(value);
      if (!parsed.success || !fresh(parsed.data) || entries.some(entry => entry.event.id === parsed.data.id)) return;
      entries = [...entries.filter(entry => fresh(entry.event)), { event: parsed.data, pending: [...PROVIDERS] }].slice(-MAX_EVENTS); persist();
    },
    flush, purge, size: () => entries.length, available: () => available,
  };
}
