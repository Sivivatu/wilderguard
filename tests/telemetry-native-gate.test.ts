import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startEvent } from './telemetry-fixture';
const mocks = vi.hoisted(() => ({ getInfo: vi.fn(), posthog: vi.fn(async () => 'sent'), gameanalytics: vi.fn(async () => 'sent') }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: mocks.getInfo } }));
vi.mock('../src/telemetry-adapters', () => ({ telemetryAdapters: () => [
  { choice: 'posthog', scope: 'native-posthog', send: mocks.posthog },
  { choice: 'gameanalytics', scope: 'native-gameanalytics', send: mocks.gameanalytics },
] }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
  vi.stubEnv('VITE_GAMEPLAY_CHANNEL', 'beta'); vi.stubEnv('VITE_GAMEPLAY_BUILD', 'beta-test');
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('actual native package gate', () => {
  async function restartWithPendingConsent() {
    mocks.getInfo.mockResolvedValueOnce({ id: 'com.wilderguard.game.beta' });
    const { telemetry } = await import('../src/telemetry'); await Promise.resolve();
    telemetry.setEnabled(true); telemetry.record({ ...startEvent, at: Date.now() });
    expect(JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v2')!).entries).toHaveLength(1);
    vi.resetModules();
    let resolve!: (value: { id: string }) => void;
    mocks.getInfo.mockImplementationOnce(() => new Promise(result => { resolve = result; }));
    const restarted = await import('../src/telemetry');
    return { telemetry: restarted.telemetry, resolve };
  }
  it('keeps both providers off in the public Android package', async () => {
    mocks.getInfo.mockResolvedValue({ id: 'com.wilderguard.game' });
    const { telemetry } = await import('../src/telemetry');
    telemetry.setEnabled(true); telemetry.record({ ...startEvent, at: Date.now() }); await telemetry.flush();
    expect(telemetry.preference()).toBe('off'); expect(mocks.posthog).not.toHaveBeenCalled(); expect(mocks.gameanalytics).not.toHaveBeenCalled();
  });
  it('enables both providers only after successful beta package verification', async () => {
    let resolve!: (value: { id: string }) => void;
    mocks.getInfo.mockImplementation(() => new Promise(result => { resolve = result; }));
    const { telemetry, telemetrySettings } = await import('../src/telemetry');
    expect(telemetry.configured()).toBe(false); telemetry.setEnabled(true); expect(telemetry.enabled()).toBe(false);
    expect(telemetry.preference()).toBe('off');
    resolve({ id: 'com.wilderguard.game.beta' }); await Promise.resolve();
    expect(telemetry.configured()).toBe(true); telemetry.setEnabled(true);
    expect(telemetrySettings()).toContain('aria-checked="true"');
    const event = { ...startEvent, at: Date.now() };
    telemetry.record(event); await telemetry.flush();
    expect(mocks.posthog).toHaveBeenCalledExactlyOnceWith(event, expect.any(AbortSignal));
    expect(mocks.gameanalytics).toHaveBeenCalledExactlyOnceWith(event, expect.any(AbortSignal));
  });
  it('fails closed for both providers when native identity cannot be obtained', async () => {
    mocks.getInfo.mockRejectedValue(new Error('bridge unavailable'));
    const { telemetry } = await import('../src/telemetry'); await Promise.resolve();
    telemetry.setEnabled(true); await telemetry.flush(); expect(telemetry.enabled()).toBe(false);
    expect(mocks.posthog).not.toHaveBeenCalled(); expect(mocks.gameanalytics).not.toHaveBeenCalled();
  });
  it('preserves beta consent and both pending deliveries while checking identity after restart', async () => {
    const { telemetry, resolve } = await restartWithPendingConsent();
    expect(telemetry.configured()).toBe(false); expect(telemetry.enabled()).toBe(false);
    expect(JSON.parse(localStorage.getItem('wilderguard-telemetry-choice-v2')!).preference).toBe('on');
    expect(JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v2')!).entries[0].pending).toEqual(['posthog', 'gameanalytics']);
    expect(mocks.posthog).not.toHaveBeenCalled(); expect(mocks.gameanalytics).not.toHaveBeenCalled();
    resolve({ id: 'com.wilderguard.game.beta' }); await vi.advanceTimersByTimeAsync(0);
    expect(telemetry.enabled()).toBe(true); expect(telemetry.preference()).toBe('on');
    expect(mocks.posthog).toHaveBeenCalledTimes(1); expect(mocks.gameanalytics).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v2')!).entries).toEqual([]);
  });
  it('purges restored dual consent and queued data after a public package is identified', async () => {
    const { telemetry, resolve } = await restartWithPendingConsent();
    resolve({ id: 'com.wilderguard.game' }); await vi.advanceTimersByTimeAsync(0);
    expect(telemetry.enabled()).toBe(false); expect(telemetry.preference()).toBe('off');
    expect(JSON.parse(localStorage.getItem('wilderguard-telemetry-outbox-v2')!).entries).toEqual([]);
    expect(JSON.parse(localStorage.getItem('wilderguard-telemetry-choice-v2')!).preference).toBe('off');
    expect(mocks.posthog).not.toHaveBeenCalled(); expect(mocks.gameanalytics).not.toHaveBeenCalled();
  });
});
