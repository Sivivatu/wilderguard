import type { TelemetryAdapter } from './telemetry-contract';
// Foundation has no cloud transport. Subsequent stack layers register adapters here.
export function telemetryAdapters(_env: Record<string, unknown>): TelemetryAdapter[] { return []; }
