import { createTelemetryController } from './telemetry-controller';
import { createGameplayCollector } from './gameplay-telemetry';
import { readTelemetryBuild } from './telemetry-policy';
import { telemetryAdapters } from './telemetry-adapters';
const build = readTelemetryBuild(import.meta.env);
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value), removeItem: (key: string) => localStorage.removeItem(key) };
export const telemetry = createTelemetryController({ build, storage, adapters: build ? telemetryAdapters(import.meta.env) : [],
  onChange: () => gameplayTelemetry.reset() });
export const gameplayTelemetry = createGameplayCollector({ build: build ?? 'disabled', enabled: telemetry.enabled, emit: telemetry.record });

export function telemetrySettings(): string {
  const options = (['off', 'posthog', 'gameanalytics'] as const).map(choice => {
    const label = { off: 'Off', posthog: 'PostHog', gameanalytics: 'GameAnalytics' }[choice];
    return `<option value="${choice}" ${choice === telemetry.choice() ? 'selected' : ''} ${choice !== 'off' && !telemetry.configured(choice) ? 'disabled' : ''}>${label}${choice !== 'off' && !telemetry.configured(choice) ? ' (unavailable)' : ''}</option>`;
  }).join('');
  return `<h3>Optional beta gameplay statistics</h3><p>Off until you choose a configured provider. Sends wave starts and outcomes, health, diamonds, defense counts and sampled frame timings. Random run IDs reset on launch; no names, saves, exact touches, location, screenshots or replay. PostHog receives your network address; location enrichment is disabled. GameAnalytics uses a private relay, which receives your network address. Only one provider receives new statistics. Queued reports expire after 48 hours; turning Off or changing provider clears them. Sent reports cannot be recalled. This is separate from automatic error reports.</p><label class="setting-row"><span>Gameplay statistics</span><select id="gameplay-provider" aria-label="Gameplay statistics">${options}</select></label>${!build ? '<p>Gameplay statistics are disabled in this build.</p>' : ''}${!telemetry.preferenceSaved() ? '<p role="alert">Off could not be saved. Statistics are off for this session only. Clear app data before restarting or sharing this device.</p>' : ''}${!telemetry.available() ? '<p>Statistics storage is unavailable. Delivery is disabled; an Off selection may not survive restart. Clear app data before sharing this device.</p>' : ''}`;
}
// No network/storage operation is awaited by gameplay or its render loop.
if (build) {
  const flush = () => { void telemetry.flush(); };
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
  setInterval(flush, 15_000); flush();
}
