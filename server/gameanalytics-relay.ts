import { createHash, createHmac } from 'node:crypto';
import { z } from 'zod';
import { buildSchema, telemetryEventSchema, type TelemetryEvent } from '../src/telemetry-contract.ts';
import { mapGameAnalyticsEvent } from './gameanalytics-mapping.ts';
const RETENTION_MS = 48 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 8192;
const MAX_SEEN = 512;
const MAX_RUNS = 128;
const MAX_REQUESTS_PER_MINUTE = 120;
const MAX_EVENTS_PER_DAY = 2000;
const configSchema = z.object({ gameKey: z.string().regex(/^[a-f0-9]{32}$/), secret: z.string().regex(/^[a-f0-9]{40}$/), epoch: buildSchema,
  origins: z.array(z.string().url()).min(1).max(8), privacyReviewed: z.literal(true), privateDeployment: z.literal(true), environment: z.enum(['sandbox', 'production']) });
type Config = Omit<z.infer<typeof configSchema>, 'privacyReviewed' | 'privateDeployment'> & { privacyReviewed: boolean; privateDeployment: boolean };
interface Options { fetcher?: typeof fetch; now?: () => number; maxEventsPerRun?: number }
async function readEvent(request: Request): Promise<{ event: TelemetryEvent } | { status: number }> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return { status: 415 };
  const reader = request.body?.getReader();
  if (!reader) return { status: 400 };
  let bytes = 0; let text = ''; const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); return { status: 413 }; }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const parsed = telemetryEventSchema.safeParse(JSON.parse(text + decoder.decode()));
    return parsed.success ? { event: parsed.data } : { status: 400 };
  } catch { return { status: 400 }; }
}
export function createGameAnalyticsRelay(input: Config, { fetcher = fetch, now = Date.now, maxEventsPerRun = 480 }: Options = {}) {
  const config = configSchema.parse(input);
  if (config.origins.some(origin => { const url = new URL(origin); return url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))); })) throw new Error('Invalid relay origin configuration');
  if (!Number.isInteger(maxEventsPerRun) || maxEventsPerRun < 1 || maxEventsPerRun > 480) throw new Error('Invalid relay event limit');
  const host = config.environment === 'sandbox' ? 'sandbox-api.gameanalytics.com' : 'api.gameanalytics.com';
  const base = `https://${host}/v2/${config.gameKey}`;
  let seen = new Map<string, { digest: string; at: number; status: number }>();
  let runs = new Map<string, { count: number; at: number; started: boolean }>();
  let busy = false;
  let minute = -1; let requests = 0; let day = -1; let dailyEvents = 0;
  async function post(path: string, body: unknown, signal: AbortSignal) {
    const bytes = JSON.stringify(body);
    return fetcher(`${base}/${path}`, { method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
      headers: { 'Content-Type': 'application/json', Authorization: createHmac('sha256', config.secret).update(bytes).digest('base64') }, body: bytes });
  }
  async function forward(event: TelemetryEvent, digest: string, signal: AbortSignal): Promise<number> {
    const run = runs.get(event.runId);
    const rows = mapGameAnalyticsEvent(event, !run?.started);
    const alreadyReserved = !!run && seen.get(event.id)?.status === 503;
    if (!alreadyReserved && (run?.count ?? 0) + rows.length > maxEventsPerRun) return 422;
    if (dailyEvents + rows.length > MAX_EVENTS_PER_DAY) return 429;
    if (!run?.started) {
      const init = await post('init', { platform: 'webgl', os_version: 'webgl 0', sdk_version: 'rest api v2' }, signal);
      if (!init.ok) return init.status >= 500 || [408, 429].includes(init.status) ? 503 : 422;
      const status = z.object({ enabled: z.boolean().optional(), server_ts: z.number().int() }).safeParse(await init.json());
      if (!status.success || status.data.enabled === false) return 422;
      // Remote configuration/experiments are deliberately ignored. Original capture time is preserved.
    }
    // Bound every network attempt, but reserve logical run quota once per stable event.
    dailyEvents += rows.length;
    const reserved = { count: (run?.count ?? 0) + (alreadyReserved ? 0 : rows.length), at: now(), started: run?.started ?? false };
    runs = new Map([...runs, [event.runId, reserved] as const].slice(-MAX_RUNS));
    seen = new Map([...seen, [event.id, { digest, at: now(), status: 503 }] as const].slice(-MAX_SEEN));
    const response = await post('events', rows, signal);
    if (response.status !== 200) return response.status >= 500 || [408, 429].includes(response.status) ? 503 : 422;
    runs = new Map([...runs, [event.runId, { ...reserved, started: true }] as const].slice(-MAX_RUNS));
    return 200;
  }
  return async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get('origin') ?? '';
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(config.origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Telemetry-Epoch' } : {}) };
    const reply = (status: number) => new Response(status === 200 ? '{"accepted":true}' : '{"accepted":false}', { status, headers });
    if (!config.origins.includes(origin)) return reply(403);
    if (new URL(request.url).pathname !== '/telemetry') return reply(404);
    if (request.method === 'OPTIONS') return reply(200);
    if (request.method !== 'POST') return reply(405);
    if (request.headers.get('x-telemetry-epoch') !== config.epoch) return reply(409);
    const currentMinute = Math.floor(now() / 60000); const currentDay = Math.floor(now() / 86400000);
    if (currentMinute !== minute) { minute = currentMinute; requests = 0; }
    if (currentDay !== day) { day = currentDay; dailyEvents = 0; }
    requests += 1; if (requests > MAX_REQUESTS_PER_MINUTE) return reply(429);
    const parsed = await readEvent(request); if ('status' in parsed) return reply(parsed.status);
    const event = parsed.event;
    if (event.at < now() - RETENTION_MS || event.at > now() + 60000) return reply(422);
    seen = new Map([...seen].filter(([, item]) => item.at > now() - RETENTION_MS));
    runs = new Map([...runs].filter(([, item]) => item.at > now() - RETENTION_MS));
    const digest = createHash('sha256').update(JSON.stringify(event)).digest('hex');
    const old = seen.get(event.id);
    if (old?.digest && old.digest !== digest) return reply(409);
    if (old && old.status !== 503) return reply(old.status);
    if (busy) return reply(503);
    busy = true;
    try {
      const status = await forward(event, digest, request.signal);
      if (status === 200 || status === 422) seen = new Map([...seen, [event.id, { digest, at: now(), status }] as const].slice(-MAX_SEEN));
      return reply(status);
    } catch { return reply(503); }
    finally { busy = false; }
  };
}
