import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startEvent } from './telemetry-fixture';
const mocks = vi.hoisted(() => ({ getInfo: vi.fn(), send: vi.fn(async () => 'sent') }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: mocks.getInfo } }));
vi.mock('../src/telemetry-adapters', () => ({ telemetryAdapters: () => [{ choice: 'posthog', scope: 'native-test', send: mocks.send }] }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
  vi.stubEnv('VITE_GAMEPLAY_CHANNEL', 'beta'); vi.stubEnv('VITE_GAMEPLAY_BUILD', 'beta-test');
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('actual native package gate', () => {
  it('keeps a beta-configured bundle off in the public Android package', async () => {
    mocks.getInfo.mockResolvedValue({ id: 'com.wilderguard.game' });
    const { telemetry } = await import('../src/telemetry');
    telemetry.setChoice('posthog'); telemetry.record({ ...startEvent, at: Date.now() }); await telemetry.flush();
    expect(telemetry.choice()).toBe('off'); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('allows the beta package only after successful native verification', async () => {
    let resolve!: (v: { id: string }) => void;
    mocks.getInfo.mockImplementation(() => new Promise(r => { resolve = r; }));
    const { telemetry, telemetrySettings } = await import('../src/telemetry');
    expect(telemetry.configured('posthog')).toBe(false); telemetry.setChoice('posthog'); expect(telemetry.enabled()).toBe(false);
    resolve({ id: 'com.wilderguard.game.beta' }); await Promise.resolve();
    telemetry.setChoice('posthog'); expect(telemetrySettings()).toContain('value="posthog" selected');
    telemetry.record({ ...startEvent, at: Date.now() }); await telemetry.flush(); expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it('fails closed when the native identity cannot be obtained', async () => {
    mocks.getInfo.mockRejectedValue(new Error('bridge unavailable'));
    const { telemetry } = await import('../src/telemetry'); await Promise.resolve();
    telemetry.setChoice('posthog'); await telemetry.flush(); expect(telemetry.enabled()).toBe(false); expect(mocks.send).not.toHaveBeenCalled();
  });
});
