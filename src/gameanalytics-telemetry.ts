import { buildSchema, telemetryEventSchema, type TelemetryAdapter } from './telemetry-contract';
export function createGameAnalyticsAdapter(env: Record<string, unknown>, fetcher: typeof fetch = fetch): TelemetryAdapter | null {
  const epoch = buildSchema.safeParse(env.VITE_GAMEANALYTICS_EPOCH);
  let endpoint: URL;
  try { endpoint = new URL(String(env.VITE_GAMEANALYTICS_RELAY)); } catch { return null; }
  if (!epoch.success || endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/telemetry') return null;
  return {
    choice: 'gameanalytics', scope: JSON.stringify(['gameanalytics', endpoint.href, epoch.data]),
    async send(value, signal) {
      const parsed = telemetryEventSchema.safeParse(value);
      if (!parsed.success) return 'drop';
      const response = await fetcher(endpoint.href, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json', 'X-Telemetry-Epoch': epoch.data }, body: JSON.stringify(parsed.data) });
      if (response.ok) return 'sent';
      return response.status === 408 || response.status === 429 || response.status >= 500 ? 'retry' : 'drop';
    },
  };
}
