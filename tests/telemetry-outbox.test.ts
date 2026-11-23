import { describe, expect, it, vi } from 'vitest';
import { createTelemetryOutbox, MAX_EVENTS, RETENTION_MS } from '../src/telemetry-outbox';
import { startEvent } from './telemetry-fixture';
import type { SendResult, TelemetryEvent, TelemetryProvider } from '../src/telemetry-contract';
const KEY = 'wilderguard-telemetry-outbox-v2';
function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) { data.set(key, value); }, removeItem(key: string) { data.delete(key); } };
  let now = startEvent.at;
  const send = vi.fn(async (_provider: TelemetryProvider, _event: TelemetryEvent, _signal: AbortSignal): Promise<SendResult> => 'sent');
  const make = (scope = 'both-projects') => createTelemetryOutbox({ storage, scope, now: () => now, send });
  return { data, storage, send, make, advance: (ms: number) => { now += ms; } };
}
describe('bounded dual-provider outbox', () => {
  it('sends the same immutable event id and payload to both providers exactly once', async () => {
    const f = fixture(); const q = f.make(); q.record(startEvent); q.record(startEvent); await q.flush();
    expect(f.send).toHaveBeenCalledTimes(2);
    expect(f.send.mock.calls.map(call => call[0]).sort()).toEqual(['gameanalytics', 'posthog']);
    for (const call of f.send.mock.calls) expect(call[1]).toEqual(startEvent);
    expect(q.size()).toBe(0);
  });
  it('persists independent acknowledgements and retries only the failed provider after restart', async () => {
    const f = fixture(); f.send.mockImplementation(async provider => provider === 'posthog' ? 'retry' : 'sent');
    const q = f.make(); q.record(startEvent); await q.flush(); expect(q.size()).toBe(1);
    expect(JSON.parse(f.data.get(KEY)!).entries).toEqual([{ event: startEvent, pending: ['posthog'] }]);
    f.send.mockClear(); f.send.mockResolvedValue('sent');
    const resumed = f.make(); await resumed.flush();
    expect(f.send).toHaveBeenCalledTimes(1); expect(f.send.mock.calls[0].slice(0, 2)).toEqual(['posthog', startEvent]);
    expect(resumed.size()).toBe(0);
  });
  it.each(['posthog', 'gameanalytics'] as const)('lets the healthy provider drain while %s is hung', async hung => {
    const f = fixture(); let release!: () => void;
    f.send.mockImplementation((provider, _event, signal) => provider !== hung ? Promise.resolve('sent') :
      new Promise(resolve => { release = () => resolve('retry'); signal.addEventListener('abort', () => resolve('retry')); }));
    const q = f.make(); q.record(startEvent); q.record({ ...startEvent, id: crypto.randomUUID() });
    const pending = q.flush();
    await vi.waitFor(() => expect(f.send.mock.calls.filter(call => call[0] !== hung)).toHaveLength(2));
    release(); await pending; expect(q.size()).toBe(2);
    expect(JSON.parse(f.data.get(KEY)!).entries.every((entry: { pending: string[] }) => entry.pending.join() === hung)).toBe(true);
  });
  it('isolates retry and terminal drop decisions by provider', async () => {
    const f = fixture(); f.send.mockImplementation(async provider => provider === 'posthog' ? 'retry' : 'drop');
    const q = f.make(); q.record(startEvent); q.record({ ...startEvent, id: crypto.randomUUID() }); await q.flush();
    expect(f.send.mock.calls.filter(call => call[0] === 'posthog')).toHaveLength(1);
    expect(f.send.mock.calls.filter(call => call[0] === 'gameanalytics')).toHaveLength(2);
    f.send.mockClear(); f.send.mockResolvedValue('sent'); await f.make().flush();
    expect(f.send.mock.calls.every(call => call[0] === 'posthog')).toBe(true); expect(f.send).toHaveBeenCalledTimes(2);
  });
  it('preserves current pending state when both provider acknowledgements race', async () => {
    const f = fixture(); const releases: (() => void)[] = [];
    f.send.mockImplementation(() => new Promise(resolve => { releases.push(() => resolve('sent')); }));
    const q = f.make(); q.record(startEvent); const pending = q.flush();
    await vi.waitFor(() => expect(releases).toHaveLength(2)); releases[0](); releases[1](); await pending;
    expect(q.size()).toBe(0); expect(f.make().size()).toBe(0);
  });
  it('purges and aborts both lanes without sending later events or overlapping flushes', async () => {
    const f = fixture(); const signals: AbortSignal[] = [];
    f.send.mockImplementation((_provider, _event, signal) => new Promise(resolve => {
      signals.push(signal); signal.addEventListener('abort', () => resolve('retry'));
    }));
    const q = f.make(); q.record(startEvent); q.record({ ...startEvent, id: crypto.randomUUID() });
    const pending = q.flush(); await q.flush();
    await vi.waitFor(() => expect(signals).toHaveLength(2)); q.purge(); await pending;
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(f.send).toHaveBeenCalledTimes(2); expect(f.make().size()).toBe(0);
  });
  it('bounds by 64 events, expires at 48 hours, and permanently purges changed scopes', async () => {
    const f = fixture(); const q = f.make();
    for (let i = 0; i < MAX_EVENTS + 5; i++) q.record({ ...startEvent, id: crypto.randomUUID() });
    expect(q.size()).toBe(64); expect(f.make().size()).toBe(64); expect(f.data.get(KEY)!.length).toBeLessThanOrEqual(128_000);
    f.advance(RETENTION_MS); await q.flush(); expect(q.size()).toBe(0); expect(f.send).not.toHaveBeenCalled();
    const other = fixture(); other.make().record(startEvent);
    expect(other.make('changed').size()).toBe(0); expect(other.make().size()).toBe(0);
  });
  it('rejects oversized, malformed, legacy and invalid data without delivery', async () => {
    const f = fixture();
    f.storage.setItem('wilderguard-telemetry-outbox-v1', JSON.stringify({ scope: 'both-projects', events: [startEvent] }));
    const legacy = f.make(); await legacy.flush(); expect(f.send).not.toHaveBeenCalled();
    expect(f.data.has('wilderguard-telemetry-outbox-v1')).toBe(false);
    for (const raw of ['{broken', ' '.repeat(128_001), JSON.stringify({ version: 2, scope: 'both-projects', entries: [{ event: startEvent, pending: ['unknown'] }] })]) {
      f.storage.setItem(KEY, raw); const q = f.make(); expect(q.size()).toBe(0); await q.flush();
    }
    const q = f.make(); q.record({ ...startEvent, privateData: 'no' } as never);
    q.record({ ...startEvent, at: startEvent.at + 1 }); expect(q.size()).toBe(0); expect(f.send).not.toHaveBeenCalled();
  });
  it('fails closed on read/write errors and aborts both lanes after persistence fails', async () => {
    const f = fixture(); let blocked = false;
    const storage = { ...f.storage, setItem(key: string, value: string) { if (blocked) throw Error('quota'); f.storage.setItem(key, value); } };
    const signals: AbortSignal[] = [];
    f.send.mockImplementation((_provider, _event, signal) => new Promise(resolve => {
      signals.push(signal); signal.addEventListener('abort', () => resolve('retry'));
    }));
    const q = createTelemetryOutbox({ storage, scope: 'both-projects', now: () => startEvent.at, send: f.send });
    q.record(startEvent); const pending = q.flush(); await vi.waitFor(() => expect(signals).toHaveLength(2));
    blocked = true; q.record({ ...startEvent, id: crypto.randomUUID() }); await pending;
    expect(q.available()).toBe(false); expect(q.size()).toBe(0); expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(f.data.has(KEY)).toBe(false);
    const unreadable = createTelemetryOutbox({ storage: { ...f.storage, getItem() { throw Error('blocked'); } }, scope: 'both-projects', send: f.send });
    expect(unreadable.available()).toBe(false);
  });
});
