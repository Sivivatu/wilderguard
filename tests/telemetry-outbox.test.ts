import { describe, expect, it, vi } from 'vitest';
import { createTelemetryOutbox, MAX_EVENTS, RETENTION_MS } from '../src/telemetry-outbox';
import { startEvent } from './telemetry-fixture';
function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  let now = startEvent.at; const send = vi.fn(async () => 'sent' as const);
  const make = (scope = 'project-a') => createTelemetryOutbox({ storage, scope, now: () => now, send });
  return { data, storage, send, make, advance: (ms: number) => { now += ms; } };
}
describe('bounded isolated outbox', () => {
  it('survives recreation, retries the same id and expires without delivery', async () => {
    const f = fixture(); const q = f.make(); q.record(startEvent);
    f.send.mockRejectedValueOnce(new Error('offline'));
    await q.flush(); expect(q.size()).toBe(1);
    const resumed = f.make(); await resumed.flush(); expect(resumed.size()).toBe(0);
    expect(f.send.mock.calls[0]).toEqual(f.send.mock.calls[1]);
    resumed.record(startEvent); f.advance(RETENTION_MS + 1); await resumed.flush(); expect(f.send).toHaveBeenCalledTimes(2);
  });
  it('drops oldest on overflow and purges after project/provider change', () => {
    const f = fixture(); const q = f.make();
    for (let i = 0; i < MAX_EVENTS + 5; i++) q.record({ ...startEvent, id: crypto.randomUUID() });
    expect(q.size()).toBe(MAX_EVENTS); expect(f.make().size()).toBe(MAX_EVENTS); expect(f.make('gameanalytics:project-b').size()).toBe(0); expect(f.make('project-a').size()).toBe(0);
  });
  it('serializes flushes and prevents a switched-off in-flight queue from sending more', async () => {
    const f = fixture(); let release!: () => void;
    f.send.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve('sent'); }));
    const q = f.make(); q.record(startEvent); q.record({ ...startEvent, id: crypto.randomUUID() });
    const pending = q.flush(); await q.flush(); q.purge(); release(); await pending;
    expect(f.send).toHaveBeenCalledTimes(1); expect(f.make().size()).toBe(0);
  });
  it('fails closed on storage errors, corrupted data, invalid events, and terminal rejection', async () => {
    const f = fixture(); f.storage.setItem('wilderguard-telemetry-outbox-v1', '{broken');
    const q = f.make(); expect(q.size()).toBe(0); q.record({ ...startEvent, privateData: 'no' } as never); expect(q.size()).toBe(0);
    f.send.mockResolvedValueOnce('drop' as never); q.record(startEvent); await q.flush(); expect(q.size()).toBe(0);
    const broken = createTelemetryOutbox({ storage: { getItem() { throw Error(); }, setItem() { throw Error(); } }, scope: 'a', send: f.send });
    expect(() => broken.record(startEvent)).not.toThrow(); await broken.flush(); expect(broken.size()).toBe(0);
  });
});
