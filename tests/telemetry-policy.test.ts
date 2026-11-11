import { describe, expect, it } from 'vitest';
import { readTelemetryBuild, readChoice, saveChoice } from '../src/telemetry-policy';
describe('telemetry policy', () => {
  it('requires an explicit beta build and a safe version', () => {
    expect(readTelemetryBuild({})).toBeNull();
    expect(readTelemetryBuild({ VITE_GAMEPLAY_CHANNEL: 'release', VITE_GAMEPLAY_BUILD: 'beta-test' })).toBeNull();
    expect(readTelemetryBuild({ VITE_GAMEPLAY_CHANNEL: 'beta', VITE_GAMEPLAY_BUILD: 'beta-test' })).toBe('beta-test');
    expect(readTelemetryBuild({ VITE_GAMEPLAY_CHANNEL: 'beta', VITE_GAMEPLAY_BUILD: '<private>' })).toBeNull();
  });
  it('persists exactly one provider scoped to the configured project, and defaults off', () => {
    const data = new Map<string, string>(); const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
    expect(readChoice(storage, 'a')).toBe('off'); expect(saveChoice(storage, 'a', 'posthog')).toBe(true);
    expect(readChoice(storage, 'a')).toBe('posthog'); expect(readChoice(storage, 'b')).toBe('off');
    saveChoice(storage, 'a', 'off'); expect(readChoice(storage, 'a')).toBe('off');
    expect(readChoice({ getItem() { throw Error(); } }, 'a')).toBe('off');
  });
});
