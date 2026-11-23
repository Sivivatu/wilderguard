import { describe, expect, it, vi } from 'vitest';
import { createGameAnalyticsAdapter } from '../src/gameanalytics-telemetry';
import { startEvent } from './telemetry-fixture';
const config = { VITE_GAMEANALYTICS_RELAY: 'https://private.example.test/telemetry', VITE_GAMEANALYTICS_EPOCH: 'family-1' };
describe('GameAnalytics private relay adapter', () => {
  it('requires a secure credential-free endpoint and explicit project epoch', () => {
    expect(createGameAnalyticsAdapter({})).toBeNull();
    for (const url of ['http://example.test/telemetry', 'https://user:secret@example.test/telemetry', 'https://example.test/telemetry?key=private', 'https://example.test/other', 'file:///telemetry']) expect(createGameAnalyticsAdapter({ ...config, VITE_GAMEANALYTICS_RELAY: url })).toBeNull();
    expect(createGameAnalyticsAdapter({ ...config, VITE_GAMEANALYTICS_EPOCH: '' })).toBeNull();
    expect(createGameAnalyticsAdapter(config)?.scope).not.toEqual(createGameAnalyticsAdapter({ ...config, VITE_GAMEANALYTICS_EPOCH: 'family-2' })?.scope);
  });
  it('sends only the neutral contract and epoch, with no embedded service secret', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const adapter = createGameAnalyticsAdapter(config, fetcher)!;
    const signal = new AbortController().signal;
    expect(await adapter.send(startEvent, signal)).toBe('sent');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(config.VITE_GAMEANALYTICS_RELAY); expect(options).toMatchObject({ signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
    expect(JSON.parse(options!.body as string)).toEqual(startEvent);
    expect(options!.headers).toEqual({ 'Content-Type': 'application/json', 'X-Telemetry-Epoch': 'family-1' });
    expect(await adapter.send({ ...startEvent, private: 'no' } as never, signal)).toBe('drop'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([[400, 'drop'], [409, 'drop'], [422, 'drop'], [408, 'retry'], [429, 'retry'], [503, 'retry']])('classifies relay status %i as %s', async (status, result) => {
    const adapter = createGameAnalyticsAdapter(config, async () => new Response(null, { status: status as number }))!;
    expect(await adapter.send(startEvent, new AbortController().signal)).toBe(result);
  });
});
