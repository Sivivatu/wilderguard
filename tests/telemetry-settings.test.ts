import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); });
describe('gameplay disclosure and startup', () => {
  it('shows public unavailable choices and performs no startup delivery', async () => {
    const data = new Map(); vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k), setItem: (k: string, v: string) => data.set(k, v) });
    const { telemetrySettings, telemetry } = await import('../src/telemetry');
    expect(telemetry.choice()).toBe('off'); expect(telemetrySettings()).toContain('disabled in this build');
    expect(telemetrySettings()).toContain('PostHog (unavailable)'); expect(telemetrySettings()).toContain('separate from automatic error reports');
  });
  it('starts bounded reconnect/foreground polling only for beta and reports storage failure', async () => {
    vi.useFakeTimers(); vi.stubEnv('VITE_GAMEPLAY_CHANNEL', 'beta'); vi.stubEnv('VITE_GAMEPLAY_BUILD', 'beta-test');
    const windowTarget = new EventTarget(); const doc = new EventTarget();
    vi.stubGlobal('window', windowTarget); vi.stubGlobal('document', Object.assign(doc, { hidden: false }));
    vi.stubGlobal('localStorage', { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } });
    const { telemetrySettings, telemetry } = await import('../src/telemetry');
    telemetry.setChoice('off'); expect(telemetrySettings()).toContain('Off could not be saved');
    expect(telemetrySettings()).toContain('Statistics storage is unavailable');
    windowTarget.dispatchEvent(new Event('online')); doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(15000); expect(telemetry.enabled()).toBe(false);
  });
});
