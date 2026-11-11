import type { TelemetryAdapter } from './telemetry-contract';
import { createGameAnalyticsAdapter } from './gameanalytics-telemetry';
import { createPostHogAdapter } from './posthog-telemetry';
export function telemetryAdapters(env: Record<string, unknown>): TelemetryAdapter[] {
  const posthog = createPostHogAdapter(env);
  const gameanalytics = createGameAnalyticsAdapter(env);
  return [posthog, gameanalytics].filter((adapter): adapter is TelemetryAdapter => adapter !== null);
}
