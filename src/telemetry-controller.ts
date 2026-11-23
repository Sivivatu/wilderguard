import { createTelemetryOutbox } from './telemetry-outbox';
import { readPreference, savePreference } from './telemetry-policy';
import { buildSchema, type TelemetryAdapter, type TelemetryEvent, type TelemetryPreference, type TelemetryStorage } from './telemetry-contract';
interface Options { build: string | null; storage: TelemetryStorage; adapters: TelemetryAdapter[]; onChange?(): void; allowed?(): boolean }
export function createTelemetryController({ build, storage, adapters, onChange, allowed = () => true }: Options) {
  const destinations = [...adapters].sort((left, right) => left.choice.localeCompare(right.choice));
  const scope = JSON.stringify({ build, providers: destinations.map(adapter => [adapter.choice, adapter.scope]) });
  const hasConfiguration = () => buildSchema.safeParse(build).success && destinations.length === 2 &&
    destinations.filter(adapter => adapter.choice === 'posthog').length === 1 &&
    destinations.filter(adapter => adapter.choice === 'gameanalytics').length === 1;
  const configured = () => hasConfiguration() && allowed();
  let policyAvailable = true;
  try {
    const key = 'wilderguard-telemetry-choice-v1';
    if (storage.removeItem) storage.removeItem(key); else storage.setItem(key, '');
  } catch { policyAvailable = false; }
  // Native identity verification may still be pending. Preserve durable consent,
  // but gate all collection and delivery on allowed(); explicit denial revokes it.
  let preference: TelemetryPreference = hasConfiguration() && policyAvailable ? readPreference(storage, scope) : 'off';
  let preferenceSaved = true;
  const queue = createTelemetryOutbox({ storage, scope, send(provider, event, signal) {
    const adapter = destinations.find(item => item.choice === provider);
    return enabled() && adapter ? adapter.send(event, signal) : Promise.resolve('retry');
  } });
  function revoke() {
    preference = 'off'; queue.purge();
    preferenceSaved = savePreference(storage, scope, 'off');
    if (!preferenceSaved) policyAvailable = false;
  }
  function reconcile() {
    if (preference === 'on' && (!hasConfiguration() || !queue.available() || !policyAvailable || readPreference(storage, scope) !== 'on')) revoke();
  }
  function enabled() {
    reconcile();
    return preference === 'on' && configured() && policyAvailable && queue.available();
  }
  // No queue is deliverable without fresh v2 consent for this exact configuration.
  if (preference === 'off' || !queue.available()) revoke();
  return {
    preference: () => { reconcile(); return preference; }, enabled, configured,
    available: () => policyAvailable && queue.available(), preferenceSaved: () => preferenceSaved,
    record(event: TelemetryEvent) { if (enabled() && event.build === build) queue.record(event); reconcile(); },
    async flush() { if (enabled()) await queue.flush(); reconcile(); },
    setEnabled(value: boolean) {
      revoke();
      if (value === true && configured() && policyAvailable && queue.available() && preferenceSaved) {
        preferenceSaved = savePreference(storage, scope, 'on');
        if (preferenceSaved) preference = 'on';
      }
      onChange?.();
    },
  };
}
