import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { createTelemetryController } from './telemetry-controller';
import { createGameplayCollector } from './gameplay-telemetry';
import { readTelemetryBuild } from './telemetry-policy';
import { telemetryAdapters } from './telemetry-adapters';
const build = readTelemetryBuild(import.meta.env);
let nativeAllowed = !Capacitor.isNativePlatform();
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value), removeItem: (key: string) => localStorage.removeItem(key) };
export const telemetry = createTelemetryController({ build, storage, adapters: build ? telemetryAdapters(import.meta.env) : [],
  allowed: () => nativeAllowed, onChange: () => gameplayTelemetry.reset() });
export const gameplayTelemetry = createGameplayCollector({ build: build ?? 'disabled', enabled: telemetry.enabled, emit: telemetry.record });

export function telemetrySettings(): string {
  const isOn = telemetry.preference() === 'on';
  return `<h3>Optional beta gameplay statistics</h3><p>Off until you turn On. When On, sends the same gameplay statistics to both PostHog and GameAnalytics: wave starts and outcomes, health, diamonds, defense counts and sampled frame timings. Random run IDs reset on launch; no names, saves, exact touches, location, screenshots or replay. PostHog receives your network address; location enrichment is disabled. GameAnalytics uses a private relay, which receives your network address. Queued reports expire after 48 hours; turning Off clears queued reports and cancels pending delivery to both providers. Sent reports cannot be recalled. This is separate from automatic error reports.</p><button class="setting-row" id="toggle-gameplay-statistics" role="switch" aria-label="Gameplay statistics" aria-checked="${isOn}" ${!telemetry.configured() ? 'disabled' : ''}><span>Gameplay statistics</span><strong>${isOn ? 'On' : 'Off'}</strong></button>${!build ? '<p>Gameplay statistics are disabled in this build.</p>' : ''}${!telemetry.preferenceSaved() ? '<p role="alert">Off could not be saved. Statistics are off for this session only. Clear app data before restarting or sharing this device.</p>' : ''}${!telemetry.available() ? '<p>Statistics storage is unavailable. Delivery is disabled; an Off selection may not survive restart. Clear app data before sharing this device.</p>' : ''}`;
}
// No network/storage operation is awaited by gameplay or its render loop.
if (build) {
  const flush = () => { void telemetry.flush(); };
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
  setInterval(flush, 15_000); flush();
  if (Capacitor.isNativePlatform()) {
    // A beta-configured web bundle must still stay off inside a public Android package.
    void App.getInfo().then(info => {
      nativeAllowed = info.id === 'com.wilderguard.game.beta';
      if (nativeAllowed) flush(); else telemetry.setEnabled(false);
    }).catch(() => { nativeAllowed = false; telemetry.setEnabled(false); });
  }
}
