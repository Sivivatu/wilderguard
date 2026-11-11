import { describe, expect, it, vi } from 'vitest';
import { createPostHogAdapter } from '../src/posthog-telemetry';
import { startEvent } from './telemetry-fixture';
const config = { VITE_POSTHOG_TOKEN: 'phc_testproject000000000000000000', VITE_POSTHOG_HOST: 'https://eu.i.posthog.com', VITE_POSTHOG_EPOCH: 'family-beta-1', VITE_POSTHOG_IP_DISCARD_CONFIRMED: 'true' };
describe('minimal PostHog capture adapter', () => {
  it('requires EU host, public token, project epoch and explicit IP-discard confirmation', () => {
    expect(createPostHogAdapter({})).toBeNull();
    for (const extra of [{ VITE_POSTHOG_HOST: 'https://attacker.test' }, { VITE_POSTHOG_HOST: 'https://eu.i.posthog.com/redirect' }, { VITE_POSTHOG_TOKEN: 'phx_personal_secret' }, { VITE_POSTHOG_EPOCH: '' }, { VITE_POSTHOG_IP_DISCARD_CONFIRMED: '' }]) expect(createPostHogAdapter({ ...config, ...extra })).toBeNull();
    expect(createPostHogAdapter(config)?.choice).toBe('posthog');
    expect(createPostHogAdapter({ ...config, VITE_POSTHOG_EPOCH: 'two' })?.scope).not.toBe(createPostHogAdapter(config)?.scope);
  });
  it('captures only the allowlisted event with stable uuid/time, ephemeral identity and both privacy flags', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    const adapter = createPostHogAdapter(config, fetcher)!; const signal = new AbortController().signal;
    expect(await adapter.send(startEvent, signal)).toBe('sent');
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/');
    expect(options).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal });
    const body = JSON.parse(options.body as string);
    expect(body).toEqual({ api_key: config.VITE_POSTHOG_TOKEN, event: 'wilderguard_wave_start_v1', uuid: startEvent.id, distinct_id: startEvent.runId, timestamp: new Date(startEvent.at).toISOString(), properties: { ...startEvent, $process_person_profile: false, $geoip_disable: true } });
    expect(JSON.stringify(body)).not.toMatch(/\$device|\$browser|\$current_url|\$session|\$set|replay|latitude|user_agent/);
    expect(await adapter.send({ ...startEvent, private: 'secret' } as never, signal)).toBe('drop'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([[204, 'sent'], [400, 'drop'], [401, 'drop'], [403, 'drop'], [408, 'retry'], [429, 'retry'], [500, 'retry']])('classifies HTTP %i as %s', async (status, result) => {
    const adapter = createPostHogAdapter(config, vi.fn(async () => new Response(null, { status: status as number })))!;
    expect(await adapter.send(startEvent, new AbortController().signal)).toBe(result);
  });
  it('propagates aborted/offline requests to the durable outbox', async () => {
    const adapter = createPostHogAdapter(config, vi.fn(async () => { throw Error('offline'); }))!;
    await expect(adapter.send(startEvent, new AbortController().signal)).rejects.toThrow('offline');
  });
});
