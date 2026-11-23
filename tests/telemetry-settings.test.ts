import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ providers: ['posthog', 'gameanalytics'] as string[] }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('../src/telemetry-adapters', () => ({ telemetryAdapters: () => mocks.providers.map(choice => ({ choice, scope: `settings-${choice}`, send: vi.fn(async () => 'sent') })) }));

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); mocks.providers = ['posthog', 'gameanalytics'];
  vi.stubEnv('VITE_GAMEPLAY_CHANNEL', 'beta'); vi.stubEnv('VITE_GAMEPLAY_BUILD', 'beta-test');
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); });

function expectSwitch(html: string, enabled: boolean, disabled = false) {
  const button = html.match(/<button\b[^>]*id="toggle-gameplay-statistics"[^>]*>[\s\S]*?<\/button>/)?.[0];
  expect(button).toBeDefined();
  expect(button).toContain('role="switch"'); expect(button).toContain('aria-label="Gameplay statistics"');
  expect(button).toContain(`aria-checked="${enabled}"`); expect(button).toContain(`<strong>${enabled ? 'On' : 'Off'}</strong>`);
  expect(/\sdisabled(?:[\s=>])/.test(button!)).toBe(disabled);
  expect(html).not.toMatch(/<select|gameplay-provider|<option/);
}

describe('gameplay disclosure and startup', () => {
  it('shows one unavailable Off switch in a public build', async () => {
    vi.stubEnv('VITE_GAMEPLAY_CHANNEL', ''); vi.stubEnv('VITE_GAMEPLAY_BUILD', '');
    const { telemetrySettings, telemetry } = await import('../src/telemetry');
    expect(telemetry.preference()).toBe('off'); expect(telemetry.enabled()).toBe(false);
    expectSwitch(telemetrySettings(), false, true);
    expect(telemetrySettings()).toContain('disabled in this build');
  });

  it('requires fresh consent and explicitly discloses delivery to both providers', async () => {
    localStorage.setItem('wilderguard-telemetry-choice-v1', JSON.stringify({ version: 1, scope: JSON.stringify(['settings-posthog', 'settings-gameanalytics']), choice: 'posthog' }));
    const { telemetrySettings, telemetry } = await import('../src/telemetry');
    expect(telemetry.preference()).toBe('off'); expectSwitch(telemetrySettings(), false);
    expect(telemetrySettings()).toMatch(/both PostHog and GameAnalytics/);
    expect(telemetrySettings()).toContain('network address');
    expect(telemetrySettings()).toContain('separate from automatic error reports');
    expect(telemetrySettings()).toContain('Sent reports cannot be recalled');
    telemetry.setEnabled(true);
    expect(telemetry.preference()).toBe('on'); expectSwitch(telemetrySettings(), true);
    telemetry.setEnabled(false);
    expect(telemetry.preference()).toBe('off'); expectSwitch(telemetrySettings(), false);
  });

  it.each(['posthog', 'gameanalytics'])('disables the switch when only %s is configured', async provider => {
    mocks.providers = [provider];
    const { telemetrySettings, telemetry } = await import('../src/telemetry');
    expect(telemetry.configured()).toBe(false); expectSwitch(telemetrySettings(), false, true);
    telemetry.setEnabled(true); expect(telemetry.enabled()).toBe(false);
    expect(telemetry.preference()).toBe('off');
  });

  it('reports failed Off persistence and leaves polling unable to send', async () => {
    vi.stubGlobal('localStorage', { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } });
    const { telemetrySettings, telemetry } = await import('../src/telemetry');
    telemetry.setEnabled(false); expect(telemetrySettings()).toContain('Off could not be saved');
    expect(telemetrySettings()).toContain('Statistics storage is unavailable');
    window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(15000); expect(telemetry.enabled()).toBe(false);
  });
});
