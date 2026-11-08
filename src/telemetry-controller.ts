import { createTelemetryOutbox } from './telemetry-outbox';
import { readChoice, saveChoice } from './telemetry-policy';
import type { ProviderChoice, TelemetryAdapter, TelemetryEvent, TelemetryStorage } from './telemetry-contract';
interface Options { build: string | null; storage: TelemetryStorage; adapters: TelemetryAdapter[]; onChange?(): void; allowed?(): boolean }
export function createTelemetryController({ build, storage, adapters, onChange, allowed = () => true }: Options) {
  const scope = JSON.stringify(adapters.map(adapter => adapter.scope));
  let choice: ProviderChoice = build ? readChoice(storage, scope) : 'off';
  const adapter = () => adapters.find(item => item.choice === choice);
  if (!adapter()) choice = 'off';
  let preferenceSaved = true;
  let queue = makeQueue();
  function makeQueue() {
    const selected = adapter();
    return createTelemetryOutbox({ storage, scope: build && selected ? `${build}:${selected.scope}` : 'off',
      send: (event, signal) => selected && choice === selected.choice && readChoice(storage, scope) === choice ? selected.send(event, signal) : Promise.resolve('retry') });
  }
  const enabled = () => !!build && allowed() && choice !== 'off' && queue.available();
  return {
    choice: () => choice, enabled, available: () => queue.available(), preferenceSaved: () => preferenceSaved,
    configured: (value: ProviderChoice) => !!build && allowed() && adapters.some(item => item.choice === value),
    record(event: TelemetryEvent) { if (enabled()) queue.record(event); },
    async flush() { if (enabled()) await queue.flush(); },
    setChoice(value: ProviderChoice) {
      queue.purge(); choice = 'off';
      // Persist off first so a failed new preference cannot preserve old consent.
      const storedOff = saveChoice(storage, scope, 'off'); preferenceSaved = storedOff;
      if (storedOff && build && allowed() && adapters.some(item => item.choice === value) && saveChoice(storage, scope, value)) choice = value;
      queue = makeQueue(); onChange?.();
    },
  };
}
