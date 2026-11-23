import { buildSchema, type TelemetryPreference, type TelemetryStorage } from './telemetry-contract';
const CHOICE_KEY = 'wilderguard-telemetry-choice-v2';
export function readTelemetryBuild(env: Record<string, unknown>): string | null {
  if (env.VITE_GAMEPLAY_CHANNEL !== 'beta') return null;
  const build = buildSchema.safeParse(env.VITE_GAMEPLAY_BUILD);
  return build.success ? build.data : null;
}
export function readPreference(storage: Pick<TelemetryStorage, 'getItem'>, scope: string): TelemetryPreference {
  try {
    const value = JSON.parse(storage.getItem(CHOICE_KEY) ?? 'null');
    if (value?.version === 2 && value.scope === scope && ['off', 'on'].includes(value.preference)) return value.preference;
  } catch { /* Missing, inaccessible or corrupt preferences always mean off. */ }
  return 'off';
}
export function savePreference(storage: TelemetryStorage, scope: string, preference: TelemetryPreference): boolean {
  try { storage.setItem(CHOICE_KEY, JSON.stringify({ version: 2, scope, preference })); return true; }
  catch {
    if (preference !== 'off' || !storage.removeItem) return false;
    try { storage.removeItem(CHOICE_KEY); return true; } catch { return false; }
  }
}
