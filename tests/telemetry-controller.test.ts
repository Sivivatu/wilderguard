import { describe, expect, it, vi } from 'vitest';
import { createTelemetryController } from '../src/telemetry-controller';
import { telemetryAdapters } from '../src/telemetry-adapters';
import { startEvent } from './telemetry-fixture';
import type { TelemetryAdapter } from '../src/telemetry-contract';
function fixture(build: string | null = 'beta-test') {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  const posthog = { choice: 'posthog', scope: 'posthog:a', send: vi.fn(async () => 'sent') } as TelemetryAdapter;
  const ga = { choice: 'gameanalytics', scope: 'ga:a', send: vi.fn(async () => 'sent') } as TelemetryAdapter;
  const changed = vi.fn();
  const make = (adapters = [posthog, ga]) => createTelemetryController({ build, storage, adapters, onChange: changed });
  return { make, storage, posthog, ga, changed };
}
describe('exclusive telemetry controller', () => {
  it('defaults off, persists consent, delivers only to selected adapter, and purges on switching', async () => {
    const f = fixture(); const c = f.make(); c.record(startEvent); await c.flush(); expect(f.posthog.send).not.toHaveBeenCalled();
    c.setChoice('posthog'); c.record({ ...startEvent, at: Date.now() });
    const resumed = f.make(); expect(resumed.choice()).toBe('posthog'); await resumed.flush(); expect(f.posthog.send).toHaveBeenCalledTimes(1);
    resumed.record({ ...startEvent, at: Date.now() }); resumed.setChoice('gameanalytics'); await resumed.flush();
    expect(f.ga.send).not.toHaveBeenCalled(); resumed.record({ ...startEvent, at: Date.now() }); await resumed.flush(); expect(f.ga.send).toHaveBeenCalledTimes(1);
    resumed.setChoice('off'); expect(f.changed).toHaveBeenCalledTimes(3); expect(resumed.enabled()).toBe(false);
    expect(f.make([{ ...f.posthog, scope: 'posthog:b' }]).choice()).toBe('off');
  });
  it('public, unconfigured, corrupt and storage-blocked cases fail closed', async () => {
    const publicBuild = fixture(null); const c = publicBuild.make(); c.setChoice('posthog'); c.record(startEvent); await c.flush(); expect(c.choice()).toBe('off');
    expect(c.configured('posthog')).toBe(false); expect(telemetryAdapters({})).toEqual([]);
    const broken = createTelemetryController({ build: 'beta-test', storage: { getItem: () => 'bad', setItem() { throw Error(); } }, adapters: [publicBuild.posthog] });
    broken.setChoice('posthog'); expect(broken.available()).toBe(false); expect(broken.enabled()).toBe(false); await broken.flush();
    const unknown = fixture().make([]); unknown.setChoice('gameanalytics'); expect(unknown.choice()).toBe('off');
  });
});

describe('durable revocation', () => {
  it('removes old consent and queue if quota blocks writes during opt-out', async () => {
    const data = new Map<string, string>(); let quota = false;
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem(key: string, value: string) { if (quota) throw Error('quota'); data.set(key, value); }, removeItem(key: string) { data.delete(key); } };
    const send = vi.fn(async () => 'sent' as const);
    const options = { build: 'beta-test', storage, adapters: [{ choice: 'posthog' as const, scope: 'a', send }] };
    const c = createTelemetryController(options); c.setChoice('posthog'); c.record({ ...startEvent, at: Date.now() });
    quota = true; c.setChoice('off'); quota = false;
    const restarted = createTelemetryController(options); await restarted.flush();
    expect(restarted.choice()).toBe('off'); expect(send).not.toHaveBeenCalled();
    expect(JSON.parse(data.get('wilderguard-telemetry-outbox-v1')!).events).toEqual([]);
  });
});
