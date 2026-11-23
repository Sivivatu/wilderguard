import { describe, expect, it, vi } from 'vitest';
import { createTelemetryController } from '../src/telemetry-controller';
import { startEvent } from './telemetry-fixture';
import type { TelemetryAdapter } from '../src/telemetry-contract';
function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) { data.set(key, value); }, removeItem(key: string) { data.delete(key); } };
  const posthog: TelemetryAdapter = { choice: 'posthog', scope: 'posthog:a', send: vi.fn(async () => 'sent') };
  const ga: TelemetryAdapter = { choice: 'gameanalytics', scope: 'ga:a', send: vi.fn(async () => 'sent') };
  const changed = vi.fn();
  const make = (adapters = [posthog, ga], build: string | null = 'beta-test') => createTelemetryController({ build, storage, adapters, onChange: changed });
  return { data, make, storage, posthog, ga, changed };
}
const event = () => ({ ...startEvent, at: Date.now() });
describe('single On/Off dual-provider controller', () => {
  it('defaults Off, sends to neither provider, and On delivers identical events to both', async () => {
    const f = fixture(); const c = f.make();
    expect(c.preference()).toBe('off'); expect(c.configured()).toBe(true);
    c.record(event()); await c.flush(); expect(f.posthog.send).not.toHaveBeenCalled(); expect(f.ga.send).not.toHaveBeenCalled();
    c.setEnabled(true); expect(c.preference()).toBe('on'); expect(c.enabled()).toBe(true);
    const value = event(); c.record(value); await c.flush();
    expect(f.posthog.send).toHaveBeenCalledExactlyOnceWith(value, expect.any(AbortSignal));
    expect(f.ga.send).toHaveBeenCalledExactlyOnceWith(value, expect.any(AbortSignal));
    expect(f.changed).toHaveBeenCalledTimes(1);
  });
  it('restores On and queued events under canonical provider order', async () => {
    const f = fixture(); const c = f.make(); c.setEnabled(true); const value = event(); c.record(value);
    const resumed = f.make([f.ga, f.posthog]); expect(resumed.preference()).toBe('on'); await resumed.flush();
    expect(f.ga.send).toHaveBeenCalledExactlyOnceWith(value, expect.any(AbortSignal));
    expect(f.posthog.send).toHaveBeenCalledExactlyOnceWith(value, expect.any(AbortSignal));
  });
  it.each(['posthog', 'gameanalytics', 'build'])('invalidates consent and old queue after %s changes', async change => {
    const f = fixture(); const c = f.make(); c.setEnabled(true); c.record(event());
    const adapters = [change === 'posthog' ? { ...f.posthog, scope: 'posthog:b' } : f.posthog,
      change === 'gameanalytics' ? { ...f.ga, scope: 'ga:b' } : f.ga];
    const changed = f.make(adapters, change === 'build' ? 'beta-next' : 'beta-test');
    expect(changed.preference()).toBe('off'); await changed.flush();
    const previous = f.make(); expect(previous.preference()).toBe('off'); previous.setEnabled(true); await previous.flush();
    expect(f.posthog.send).not.toHaveBeenCalled(); expect(f.ga.send).not.toHaveBeenCalled();
  });
  it('requires exactly one adapter for each provider', async () => {
    const f = fixture();
    for (const adapters of [[], [f.posthog], [f.ga], [f.posthog, f.posthog, f.ga], [f.posthog, f.ga, f.ga]]) {
      const c = f.make(adapters); expect(c.configured()).toBe(false); c.setEnabled(true);
      expect(c.preference()).toBe('off'); expect(c.enabled()).toBe(false); c.record(event()); await c.flush();
    }
    expect(f.posthog.send).not.toHaveBeenCalled(); expect(f.ga.send).not.toHaveBeenCalled();
  });
  it('discards legacy provider consent and queued events without upgrading either to On', async () => {
    const f = fixture();
    f.storage.setItem('wilderguard-telemetry-choice-v1', JSON.stringify({ version: 1, scope: JSON.stringify(['posthog:a', 'ga:a']), choice: 'posthog' }));
    f.storage.setItem('wilderguard-telemetry-outbox-v1', JSON.stringify({ scope: 'beta-test:posthog:a', events: [event()] }));
    const c = f.make(); expect(c.preference()).toBe('off');
    expect(f.data.has('wilderguard-telemetry-choice-v1')).toBe(false); expect(f.data.has('wilderguard-telemetry-outbox-v1')).toBe(false);
    c.setEnabled(true); await c.flush(); expect(f.posthog.send).not.toHaveBeenCalled(); expect(f.ga.send).not.toHaveBeenCalled();
  });
  it('Off cancels both sends, clears pending data, and survives restart', async () => {
    const f = fixture(); const signals: AbortSignal[] = [];
    for (const adapter of [f.posthog, f.ga]) vi.mocked(adapter.send).mockImplementation((_event, signal) => new Promise(resolve => {
      signals.push(signal); signal.addEventListener('abort', () => resolve('retry'));
    }));
    const c = f.make(); c.setEnabled(true); c.record(event()); c.record({ ...event(), id: crypto.randomUUID() });
    const pending = c.flush(); await vi.waitFor(() => expect(signals).toHaveLength(2)); c.setEnabled(false); await pending;
    expect(signals.every(signal => signal.aborted)).toBe(true); expect(c.preference()).toBe('off');
    const resumed = f.make(); expect(resumed.preference()).toBe('off'); resumed.setEnabled(true); await resumed.flush();
    expect(f.posthog.send).toHaveBeenCalledTimes(1); expect(f.ga.send).toHaveBeenCalledTimes(1);
  });
  it('revokes durably when quota blocks writes and exposes storage failure', async () => {
    const f = fixture(); let quota = false;
    const storage = { ...f.storage, setItem(key: string, value: string) { if (quota) throw Error('quota'); f.storage.setItem(key, value); } };
    const c = createTelemetryController({ build: 'beta-test', storage, adapters: [f.posthog, f.ga] });
    c.setEnabled(true); c.record(event()); quota = true; c.setEnabled(false);
    expect(c.enabled()).toBe(false); expect(c.available()).toBe(false); quota = false;
    const resumed = f.make(); expect(resumed.preference()).toBe('off'); resumed.setEnabled(true); await resumed.flush();
    expect(f.posthog.send).not.toHaveBeenCalled(); expect(f.ga.send).not.toHaveBeenCalled();
  });
  it('reports a failed On preference write and never sends', async () => {
    const f = fixture(); const storage = { ...f.storage, setItem(key: string, value: string) {
      if (key.includes('choice-v2') && JSON.parse(value).preference === 'on') throw Error('quota'); f.storage.setItem(key, value);
    } };
    const c = createTelemetryController({ build: 'beta-test', storage, adapters: [f.posthog, f.ga] });
    c.setEnabled(true); expect(c.preferenceSaved()).toBe(false); expect(c.enabled()).toBe(false);
    c.record(event()); await c.flush(); expect(f.posthog.send).not.toHaveBeenCalled(); expect(f.ga.send).not.toHaveBeenCalled();
  });
  it('keeps public builds and unverified native identity Off', async () => {
    const f = fixture(); const publicBuild = f.make([f.posthog, f.ga], null);
    publicBuild.setEnabled(true); expect(publicBuild.configured()).toBe(false); expect(publicBuild.preference()).toBe('off');
    publicBuild.record(event()); await publicBuild.flush();
    let allowed = false;
    const native = createTelemetryController({ build: 'beta-test', storage: f.storage, adapters: [f.posthog, f.ga], allowed: () => allowed });
    native.setEnabled(true); expect(native.configured()).toBe(false); expect(native.enabled()).toBe(false); native.record(event()); await native.flush();
    expect(f.posthog.send).not.toHaveBeenCalled(); expect(f.ga.send).not.toHaveBeenCalled();
    allowed = true; native.setEnabled(true); native.record(event()); await native.flush();
    expect(f.posthog.send).toHaveBeenCalledTimes(1); expect(f.ga.send).toHaveBeenCalledTimes(1);
  });
});
