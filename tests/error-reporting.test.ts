import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReportingController } from '../src/error-reporting';
import type { ReportingConfig } from '../src/error-policy';
const config: ReportingConfig = { dsn: 'https://abc@o123.ingest.de.sentry.io/456', environment: 'beta', release: 'com.wilderguard.game.beta@0.1.0-beta.8+8', dist: '8', policy: 'automatic' };
function fixture(preference: string | null = null) {
  const storage = { getItem: vi.fn(() => preference), setItem: vi.fn() };
  const client = { start: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
  const load = vi.fn(async () => client);
  const prepare = vi.fn(async () => {});
  return { storage, client, load, prepare, controller: createReportingController(config, storage, load, prepare) };
}
afterEach(() => vi.restoreAllMocks());
describe('reporting lifecycle independent of gameplay', () => {
  it('does not load the SDK without config or with an explicit off preference', async () => {
    const f = fixture('off');
    await f.controller.start();
    expect(f.load).not.toHaveBeenCalled();
    await createReportingController(null, f.storage, f.load).setEnabled(true);
    expect(f.load).not.toHaveBeenCalled();
  });
  it('starts once when enabled and preserves the campaign save', async () => {
    const f = fixture('off');
    await f.controller.setEnabled(true);
    await f.controller.start();
    expect(f.client.start).toHaveBeenCalledTimes(1);
    expect(f.storage.setItem).toHaveBeenCalledWith('wilderguard-error-reporting-v1', 'on');
    expect(f.storage.setItem).not.toHaveBeenCalledWith('wilderguard-campaign-v1', expect.anything());
  });
  it('honors explicit opt-out even under automatic policy', async () => {
    const f = fixture('off');
    await f.controller.start();
    expect(f.load).not.toHaveBeenCalled();
    const automatic = fixture(null);
    await automatic.controller.start();
    expect(automatic.client.start).toHaveBeenCalledTimes(1);
  });
  it('revokes permission before stopping and cancels a pending SDK load', async () => {
    const f = fixture('on');
    let resolve!: (client: typeof f.client) => void;
    f.load.mockImplementation(() => new Promise(r => { resolve = r; }));
    const pending = f.controller.start();
    await f.controller.setEnabled(false);
    resolve(f.client);
    await pending;
    expect(f.client.start).not.toHaveBeenCalled();
    expect(f.controller.isEnabled()).toBe(false);
  });
  it('stops an active client immediately on opt-out', async () => {
    const f = fixture('on');
    await f.controller.start();
    await f.controller.setEnabled(false);
    expect(f.client.stop).toHaveBeenCalledTimes(1);
    expect(f.controller.status()).toBe('off');
  });
  it('contains module, init, stop and storage failures', async () => {
    const f = fixture('on');
    f.load.mockRejectedValue(new Error('unavailable'));
    await expect(f.controller.start()).resolves.toBeUndefined();
    expect(f.controller.status()).toBe('unavailable');
    const broken = fixture('on');
    broken.client.start.mockRejectedValue(new Error('startup'));
    broken.client.stop.mockRejectedValue(new Error('shutdown'));
    await expect(broken.controller.start()).resolves.toBeUndefined();
    await expect(broken.controller.setEnabled(false)).resolves.toBeUndefined();
    const blocked = fixture();
    blocked.storage.getItem.mockImplementation(() => { throw new Error('denied'); });
    blocked.storage.setItem.mockImplementation(() => { throw new Error('full'); });
    const controller = createReportingController(config, blocked.storage, blocked.load);
    await expect(controller.setEnabled(true)).resolves.toBeUndefined();
    expect(blocked.load).not.toHaveBeenCalled();
    expect(controller.status()).toBe('unavailable');
  });
});

it('marks failed cache cleanup unavailable without permitting new reports', async () => {
  const f = fixture();
  f.controller.markUnavailable();
  await f.controller.start();
  expect(f.load).not.toHaveBeenCalled();
  expect(f.controller.status()).toBe('unavailable');
});
it('can retry a failed SDK initialization after a successful preference write', async () => {
  const f = fixture();
  f.load.mockRejectedValueOnce(new Error('temporarily unavailable'));
  await f.controller.start();
  expect(f.controller.isEnabled()).toBe(false);
  await f.controller.setEnabled(true);
  expect(f.client.start).toHaveBeenCalledOnce();
  expect(f.controller.status()).toBe('on');
});
it('does not initialize a stale pending load after rapid off/on changes', async () => {
  const f = fixture();
  let resolveFirst!: (client: typeof f.client) => void;
  f.load.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
  const first = f.controller.start();
  await f.controller.setEnabled(false);
  await f.controller.setEnabled(true);
  resolveFirst(f.client); await first;
  expect(f.client.start).toHaveBeenCalledTimes(1);
});
it('keeps the durable off preference if purge fails before re-enabling', async () => {
  const f = fixture('off');
  f.prepare.mockRejectedValueOnce(new Error('cache unavailable'));
  await f.controller.setEnabled(true);
  expect(f.storage.setItem).not.toHaveBeenCalled();
  expect(f.client.start).not.toHaveBeenCalled();
  expect(f.controller.status()).toBe('unavailable');
  await f.controller.setEnabled(true);
  expect(f.prepare).toHaveBeenCalledTimes(2);
  expect(f.client.start).toHaveBeenCalledOnce();
});
it('waits for SDK shutdown before preparing a new enabled instance', async () => {
  const f = fixture();
  await f.controller.start();
  let finishStop!: () => void;
  f.client.stop.mockImplementationOnce(() => new Promise(resolve => { finishStop = resolve; }));
  const off = f.controller.setEnabled(false);
  await vi.waitFor(() => expect(f.client.stop).toHaveBeenCalledOnce());
  const on = f.controller.setEnabled(true);
  await Promise.resolve();
  expect(f.prepare).not.toHaveBeenCalled();
  finishStop(); await Promise.all([off, on]);
  expect(f.client.start).toHaveBeenCalledTimes(2);
  expect(f.controller.status()).toBe('on');
});
