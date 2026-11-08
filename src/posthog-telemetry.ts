import { buildSchema, telemetryEventSchema, type TelemetryAdapter } from './telemetry-contract';
const EU_HOST = 'https://eu.i.posthog.com';
/** Public capture API only: no SDK identity storage, sessions, flags, replay or autocapture. */
export function createPostHogAdapter(env: Record<string, unknown>, fetcher: typeof fetch = fetch): TelemetryAdapter | null {
  const token = env.VITE_POSTHOG_TOKEN;
  const epoch = buildSchema.safeParse(env.VITE_POSTHOG_EPOCH);
  if (env.VITE_POSTHOG_HOST !== EU_HOST || typeof token !== 'string' || !/^phc_[A-Za-z0-9]{10,128}$/.test(token)
    || !epoch.success || env.VITE_POSTHOG_IP_DISCARD_CONFIRMED !== 'true') return null;
  return {
    choice: 'posthog', scope: JSON.stringify(['posthog', EU_HOST, token, epoch.data]),
    async send(value, signal) {
      const parsed = telemetryEventSchema.safeParse(value);
      if (!parsed.success) return 'drop';
      const event = parsed.data;
      const response = await fetcher(`${EU_HOST}/i/v0/e/`, {
        method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: token, event: `wilderguard_${event.kind}_v1`, uuid: event.id,
          distinct_id: event.runId, timestamp: new Date(event.at).toISOString(),
          properties: { ...event, $process_person_profile: false, $geoip_disable: true } }),
      });
      if (response.ok) return 'sent';
      return response.status === 408 || response.status === 429 || response.status >= 500 ? 'retry' : 'drop';
    },
  };
}
