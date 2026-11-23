import { describe, expect, it } from 'vitest';
import { readTelemetryBuild, readPreference, savePreference } from '../src/telemetry-policy';
const KEY = 'wilderguard-telemetry-choice-v2';
function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) { data.set(key, value); }, removeItem(key: string) { data.delete(key); } };
  return { data, storage };
}
describe('single gameplay stats preference', () => {
  it('requires an explicit beta build and safe version', () => {
    expect(readTelemetryBuild({})).toBeNull();
    expect(readTelemetryBuild({ VITE_GAMEPLAY_CHANNEL: 'release', VITE_GAMEPLAY_BUILD: 'beta-test' })).toBeNull();
    expect(readTelemetryBuild({ VITE_GAMEPLAY_CHANNEL: 'beta', VITE_GAMEPLAY_BUILD: 'beta-test' })).toBe('beta-test');
    expect(readTelemetryBuild({ VITE_GAMEPLAY_CHANNEL: 'beta', VITE_GAMEPLAY_BUILD: '<private>' })).toBeNull();
  });
  it('stores only On or Off for the exact combined build/project scope', () => {
    const { data, storage } = fixture();
    expect(readPreference(storage, 'beta:both')).toBe('off');
    expect(savePreference(storage, 'beta:both', 'on')).toBe(true);
    expect(readPreference(storage, 'beta:both')).toBe('on');
    expect(readPreference(storage, 'other-build:both')).toBe('off');
    expect(readPreference(storage, 'beta:changed-project')).toBe('off');
    expect(JSON.parse(data.get(KEY)!)).toEqual({ version: 2, scope: 'beta:both', preference: 'on' });
    expect(savePreference(storage, 'beta:both', 'off')).toBe(true);
    expect(readPreference(storage, 'beta:both')).toBe('off');
  });
  it.each(['posthog', 'gameanalytics', 'off'])('never upgrades legacy %s consent to On', choice => {
    const { storage } = fixture();
    storage.setItem('wilderguard-telemetry-choice-v1', JSON.stringify({ version: 1, scope: 'same', choice }));
    expect(readPreference(storage, 'same')).toBe('off');
  });
  it.each(['{broken', '{}', '{"version":2,"scope":"a","preference":"posthog"}', '{"version":1,"scope":"a","preference":"on"}'])('rejects invalid preference %s', raw => {
    const { storage } = fixture(); storage.setItem(KEY, raw);
    expect(readPreference(storage, 'a')).toBe('off');
  });
  it('defaults Off when storage cannot be read and reports failed writes', () => {
    const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
    expect(readPreference(storage, 'a')).toBe('off');
    expect(savePreference(storage, 'a', 'on')).toBe(false);
    expect(savePreference(storage, 'a', 'off')).toBe(false);
  });
  it('removes consent when quota prevents an Off write', () => {
    const { storage, data } = fixture(); savePreference(storage, 'a', 'on');
    expect(savePreference({ ...storage, setItem() { throw Error('quota'); } }, 'a', 'off')).toBe(true);
    expect(data.has(KEY)).toBe(false); expect(readPreference(storage, 'a')).toBe('off');
  });
});
