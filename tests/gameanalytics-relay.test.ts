import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { mapGameAnalyticsEvent } from '../server/gameanalytics-mapping';
import { createGameAnalyticsRelay } from '../server/gameanalytics-relay';
import { startEvent } from './telemetry-fixture';
import type { TelemetryEvent } from '../src/telemetry-contract';
const end: TelemetryEvent = { ...startEvent, id: '20000000-0000-4000-8000-000000000001', kind: 'wave_end', outcome: 'clear', openingDiamonds: 50, earned: 70, spent: 30, livesLost: 4, kills: 5, activeMs: 10000, frameSamples: 20, slowFrames: 2, intervalMeanMs: 20, intervalMaxMs: 70, updateMeanMs: 3, renderMeanMs: 4 };
// Synthetic credentials only; never use real game secrets in tests or client bundles.
const config = { gameKey: '0'.repeat(32), secret: '1'.repeat(40), epoch: 'family-1', origins: ['https://localhost'], privacyReviewed: true, privateDeployment: true, environment: 'sandbox' as const };
function request(event: unknown = startEvent, origin = 'https://localhost', epoch = 'family-1') {
  return new Request('https://private.example.test/telemetry', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Telemetry-Epoch': epoch }, body: JSON.stringify(event) });
}
function fixture(extra = {}) {
  let now = startEvent.at;
  const fetcher = vi.fn<typeof fetch>(async url => new Response(JSON.stringify(String(url).endsWith('/init') ? { enabled: true, server_ts: Math.floor(now / 1000) } : {}), { status: 200 }));
  const relay = createGameAnalyticsRelay(config, { fetcher, now: () => now, ...extra });
  return { relay, fetcher, advance: (ms: number) => { now += ms; } };
}
describe('free bounded GameAnalytics mapping', () => {
  it('uses ephemeral runs and generic hardware, progression and numeric design/resource facts', () => {
    const start = mapGameAnalyticsEvent(startEvent, true);
    expect(start.map(e => e.category)).toEqual(['user', 'progression']);
    const missingStart = mapGameAnalyticsEvent(end, true);
    expect(missingStart[0].category).toBe('user');
    expect(missingStart.some(e => e.event_id === 'Start:r1:w1')).toBe(false);
    expect(start[1]).toMatchObject({ event_id: 'Start:r1:w1', user_id: startEvent.runId, session_id: startEvent.runId, session_num: 1, sdk_version: 'rest api v2', device: 'unknown', manufacturer: 'unknown', platform: 'webgl', os_version: 'webgl 0', limit_ad_tracking: true });
    const terminal = mapGameAnalyticsEvent(end, false);
    expect(terminal[0]).toMatchObject({ category: 'progression', event_id: 'Complete:r1:w1', score: 20, attempt_num: 1 });
    expect(terminal).toContainEqual(expect.objectContaining({ category: 'resource', event_id: 'Sink:Diamonds:Wave:r1w1', amount: -100 }));
    expect(terminal).toContainEqual(expect.objectContaining({ event_id: 'wg1:renderMeanMs:r1:w1:clear', value: 4 }));
    expect(terminal).toContainEqual(expect.objectContaining({ event_id: 'wg1:archer1:r1:w1:clear', value: 1 }));
    expect(25 * (mapGameAnalyticsEvent(startEvent, false).length + terminal.length) + 1).toBeLessThan(500);
    for (const event of terminal) {
      expect(event).not.toHaveProperty('custom_01'); expect(event).not.toHaveProperty('custom_fields');
      expect(JSON.stringify(event.event_id)).not.toContain(startEvent.attemptId);
    }
  });
  it('never converts abandon/interruption into Fail and bounds every event name', () => {
    const abandoned = mapGameAnalyticsEvent({ ...end, outcome: 'abandon' }, false);
    expect(abandoned.some(e => e.category === 'progression')).toBe(false);
    expect(abandoned).toContainEqual(expect.objectContaining({ event_id: 'wg1:abandon:r1:w1', value: 1 }));
    const failed = mapGameAnalyticsEvent({ ...end, outcome: 'defeat', livesRemaining: 0 }, false);
    expect(failed[0].event_id).toBe('Fail:r1:w1');
    expect(failed.every(e => !e.event_id || String(e.event_id).split(':').length <= 5)).toBe(true);
  });
});
describe('server-only authenticated bounded relay', () => {
  it('initializes, signs exact bytes, starts a session once, and deduplicates retries', async () => {
    const { relay, fetcher } = fixture();
    expect((await relay(request())).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, options] = fetcher.mock.calls[1];
    expect(url).toBe(`https://sandbox-api.gameanalytics.com/v2/${config.gameKey}/events`);
    expect(options!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: createHmac('sha256', config.secret).update(options!.body as string).digest('base64') });
    expect(JSON.stringify(options!.headers)).not.toContain(config.secret);
    expect(options).toMatchObject({ redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect((await relay(request())).status).toBe(200); expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await relay(request({ ...startEvent, region: 1 }))).status).toBe(409);
    expect((await relay(request(end))).status).toBe(200);
    expect(JSON.parse(fetcher.mock.calls[2][1]!.body as string).some((e: { category: string }) => e.category === 'user')).toBe(false);
  });
  it('rejects invalid origin, epoch, schema, oversized bodies, and expired facts without forwarding', async () => {
    const { relay, fetcher, advance } = fixture();
    expect((await relay(request(startEvent, 'https://evil.test'))).status).toBe(403);
    expect((await relay(request(startEvent, ''))).status).toBe(403);
    expect((await relay(request(startEvent, 'https://localhost', 'old-project'))).status).toBe(409);
    expect((await relay(request({ ...startEvent, save: 'private' }))).status).toBe(400);
    expect((await relay(request({ text: 'a'.repeat(10000) }))).status).toBe(413);
    advance(49 * 60 * 60 * 1000); expect((await relay(request())).status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns generic retry/drop statuses, honors disabled collection, and requires reviewed private config', async () => {
    expect(() => createGameAnalyticsRelay({ ...config, privateDeployment: false })).toThrow();
    expect(() => createGameAnalyticsRelay({ ...config, secret: '' })).toThrow();
    const f = fixture(); f.fetcher.mockRejectedValueOnce(new Error('private upstream details'));
    const failed = await f.relay(request()); expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('private');
    const disabled = fixture(); disabled.fetcher.mockResolvedValueOnce(new Response('{"enabled":false,"server_ts":1794096000}'));
    expect((await disabled.relay(request())).status).toBe(422);
    const rejected = fixture(); rejected.fetcher.mockResolvedValueOnce(new Response('{"enabled":true,"server_ts":1794096000}')).mockResolvedValueOnce(new Response('upstream debug', { status: 400 }));
    expect((await rejected.relay(request())).status).toBe(422);
    const limited = fixture({ maxEventsPerRun: 2 }); await limited.relay(request()); expect((await limited.relay(request(end))).status).toBe(422);
  });
});

it('reserves quota for potentially partial upstream ingestion before acknowledging a rejected batch', async () => {
  const f = fixture({ maxEventsPerRun: 2 });
  f.fetcher.mockResolvedValueOnce(new Response('{"enabled":true,"server_ts":1794096000}')).mockResolvedValueOnce(new Response('partial ingestion', { status: 400 }));
  expect((await f.relay(request())).status).toBe(422);
  expect((await f.relay(request({ ...startEvent, id: '30000000-0000-4000-8000-000000000001' }))).status).toBe(422);
  expect(f.fetcher).toHaveBeenCalledTimes(2);
});

it('enforces CORS/method/content/clock/rate boundaries and serializes in-flight requests', async () => {
  const f = fixture();
  const options = await f.relay(new Request('https://private.example.test/telemetry', { method: 'OPTIONS', headers: { Origin: 'https://localhost' } }));
  expect(options.status).toBe(200); expect(options.headers.get('access-control-allow-origin')).toBe('https://localhost');
  expect((await f.relay(new Request('https://private.example.test/telemetry', { headers: { Origin: 'https://localhost' } }))).status).toBe(405);
  expect((await f.relay(new Request('https://private.example.test/other', { headers: { Origin: 'https://localhost' } }))).status).toBe(404);
  expect((await f.relay(new Request('https://private.example.test/telemetry', { method: 'POST', headers: { Origin: 'https://localhost', 'X-Telemetry-Epoch': 'family-1' }, body: 'invalid' }))).status).toBe(415);
  expect((await f.relay(request({ ...startEvent, at: startEvent.at + 120000 }))).status).toBe(422);
  let resolve!: (r: Response) => void;
  f.fetcher.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const sending = f.relay(request());
  await vi.waitFor(() => expect(f.fetcher).toHaveBeenCalledTimes(1));
  expect((await f.relay(request())).status).toBe(503);
  resolve(new Response('{"enabled":true,"server_ts":1794096000}')); expect((await sending).status).toBe(200);
  for (let i = 0; i < 121; i++) await f.relay(request());
  expect((await f.relay(request())).status).toBe(429);
  f.advance(60001); expect((await f.relay(request())).status).toBe(200);
});

it('fails closed on invalid relay configuration and upstream init/events errors', async () => {
  expect(() => createGameAnalyticsRelay({ ...config, origins: ['*'] })).toThrow();
  expect(() => createGameAnalyticsRelay({ ...config, origins: ['https://localhost/path'] })).toThrow();
  expect(() => createGameAnalyticsRelay(config, { maxEventsPerRun: 481 })).toThrow();
  for (const status of [400, 429, 500]) {
    const init = fixture(); init.fetcher.mockResolvedValueOnce(new Response('{}', { status }));
    expect((await init.relay(request())).status).toBe(status === 400 ? 422 : 503);
    const events = fixture(); events.fetcher.mockResolvedValueOnce(new Response('{"enabled":true,"server_ts":1794096000}')).mockResolvedValueOnce(new Response('{}', { status }));
    expect((await events.relay(request())).status).toBe(status === 400 ? 422 : 503);
  }
  const bad = fixture(); bad.fetcher.mockResolvedValueOnce(new Response('{}')); expect((await bad.relay(request())).status).toBe(422);
  expect(mapGameAnalyticsEvent({ ...end, earned: 0, spent: 0, preparationSpent: 0 }, false).filter(row => row.category === 'resource')).toEqual([]);
});

it('reuses the same logical event reservation through transient upstream failures', async () => {
  const f = fixture({ maxEventsPerRun: 2 }); let failures = 4;
  f.fetcher.mockImplementation(async url => {
    if (String(url).endsWith('/init')) return new Response('{"enabled":true,"server_ts":1794096000}');
    if (failures-- > 0) return new Response('{}', { status: 503 });
    return new Response('{}');
  });
  for (let i = 0; i < 4; i++) expect((await f.relay(request())).status).toBe(503);
  expect((await f.relay(request())).status).toBe(200);
  expect((await f.relay(request())).status).toBe(200);
  expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/events'))).toHaveLength(5);
});

it('keeps an event retryable when conservative daily network quota is temporarily exhausted', async () => {
  const f = fixture({ maxEventsPerRun: 2 });
  f.fetcher.mockImplementation(async url => String(url).endsWith('/init')
    ? new Response('{"enabled":true,"server_ts":1794096000}') : new Response('{}', { status: 503 }));
  for (let i = 0; i < 1000; i++) { expect((await f.relay(request())).status).toBe(503); f.advance(1000); }
  expect((await f.relay(request())).status).toBe(429);
  f.advance(24 * 60 * 60 * 1000);
  expect((await f.relay(request())).status).toBe(503);
}, 10000);
