import { buildSchema, type ProviderChoice, type TelemetryStorage } from './telemetry-contract';
const CHOICE_KEY = 'wilderguard-telemetry-choice-v1';
export function readTelemetryBuild(env: Record<string, unknown>): string | null {
  if (env.VITE_GAMEPLAY_CHANNEL !== 'beta') return null;
  const build = buildSchema.safeParse(env.VITE_GAMEPLAY_BUILD);
  return build.success ? build.data : null;
}
export function readChoice(storage: Pick<TelemetryStorage, 'getItem'>, scope: string): ProviderChoice {
  try {
    const value = JSON.parse(storage.getItem(CHOICE_KEY) ?? 'null');
    if (value?.version === 1 && value.scope === scope && ['off', 'posthog', 'gameanalytics'].includes(value.choice)) return value.choice;
  } catch { /* Missing, inaccessible or corrupt preferences always mean off. */ }
  return 'off';
}
export function saveChoice(storage: TelemetryStorage, scope: string, choice: ProviderChoice): boolean {
  try { storage.setItem(CHOICE_KEY, JSON.stringify({ version: 1, scope, choice })); return true; }
  catch {
    if (choice !== 'off' || !storage.removeItem) return false;
    try { storage.removeItem(CHOICE_KEY); return true; } catch { return false; }
  }
}
