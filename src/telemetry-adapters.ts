import type { TelemetryAdapter } from './telemetry-contract';
import { createPostHogAdapter } from './posthog-telemetry';
export function telemetryAdapters(env: Record<string, unknown>): TelemetryAdapter[] {
  const posthog = createPostHogAdapter(env);
  return posthog ? [posthog] : [];
}
