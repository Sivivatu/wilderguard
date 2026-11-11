import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapacitorOptions } from '@sentry/capacitor';
const mocks = vi.hoisted(() => ({
  init: vi.fn(), close: vi.fn(async () => {}), browserInit: vi.fn(), offline: vi.fn(() => vi.fn()),
  platform: vi.fn(() => 'web'), clear: vi.fn(async () => {}), clearBrowser: vi.fn(async () => {}),
  release: vi.fn(async () => ({ id: 'com.wilderguard.game.beta', version: '0.1.0-beta.8', build: '8' })),
}));
vi.mock('@sentry/capacitor', () => ({ init: mocks.init, close: mocks.close }));
vi.mock('@sentry/browser', () => ({ init: mocks.browserInit, makeBrowserOfflineTransport: mocks.offline, globalHandlersIntegration: () => ({ name: 'GlobalHandlers' }), dedupeIntegration: () => ({ name: 'Dedupe' }) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: mocks.platform } }));
vi.mock('../src/reporting-storage', () => ({ clearReportingCaches: mocks.clear, clearBrowserReports: mocks.clearBrowser, nativeReporting: { fetchNativeRelease: mocks.release }, REPORTING_DATABASE: 'wilderguard-errors-v1' }));
import { start, stop } from '../src/sentry-client';
const config = { dsn: 'https://abc@o123.ingest.de.sentry.io/456', environment: 'beta', release: 'com.wilderguard.game.beta@0.1.0-beta.8+8', dist: '8', policy: 'automatic' } as const;
beforeEach(() => {
  vi.clearAllMocks(); mocks.platform.mockReturnValue('web');
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => config.dsn), setItem: vi.fn() });
  mocks.init.mockImplementation((options: CapacitorOptions, original: (o: CapacitorOptions) => void) => original({ ...options, transport: options.transport || (options.enableNative ? vi.fn() : undefined) }));
});
describe('official SDK boundary', () => {
  it('enables only unhandled error handlers, bounded offline storage and no optional products', async () => {
    await start(config, () => true);
    const options = mocks.init.mock.calls[0][0] as CapacitorOptions;
    expect(options.enableAutoSessionTracking).toBe(false);
    expect(options.enableLogs).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.defaultIntegrations).toBe(false);
    expect(options.integrations).toEqual([{ name: 'GlobalHandlers' }, { name: 'Dedupe' }]);
    expect(options.transportOptions).toMatchObject({ maxQueueSize: 10, flushAtStartup: true });
    expect(options.beforeBreadcrumb?.({}, {})).toBeNull();
    expect(options.beforeSendTransaction?.({} as never, {})).toBeNull();
    const clean = await options.beforeSend!({ type: undefined, exception: { values: [{ type: 'Error', value: 'private', mechanism: { handled: false, type: 'onerror' } }] } }, {});
    expect(clean).toMatchObject({ release: config.release, dist: '8', environment: 'beta' });
    expect(JSON.stringify(clean)).not.toContain('private');
  });
  it('drops late reports and transport retries after permission is revoked', async () => {
    let allowed = true;
    await start(config, () => allowed);
    const options = mocks.init.mock.calls[0][0] as CapacitorOptions;
    allowed = false;
    expect(await options.beforeSend!({ type: undefined }, {})).toBeNull();
    const transport = options.transportOptions as { shouldSend: () => boolean; shouldStore: () => boolean };
    expect(transport.shouldSend()).toBe(false); expect(transport.shouldStore()).toBe(false);
    await stop();
    expect(mocks.clear).toHaveBeenCalled(); expect(mocks.close).toHaveBeenCalled();
  });
  it('clears queues before changing destination and skips startup when permission was revoked', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('old-dsn');
    await start(config, () => false);
    expect(mocks.clear).toHaveBeenCalled(); expect(mocks.init).not.toHaveBeenCalled();
  });
  it('requires native release and channel to match the installed build', async () => {
    mocks.platform.mockReturnValue('android');
    await expect(start({ ...config, dist: '9' }, () => true)).rejects.toThrow('does not match');
    expect(mocks.init).not.toHaveBeenCalled();
    await start(config, () => true);
    expect(mocks.init.mock.calls[0][0]).toMatchObject({ enableNative: true, enableNativeCrashHandling: true });
    expect(mocks.offline).not.toHaveBeenCalled();
  });
  it('shuts down rather than completing a late SDK initialization after revocation', async () => {
    let allowed = true;
    mocks.init.mockImplementation((options, original) => { allowed = false; original(options); });
    await start(config, () => allowed);
    expect(mocks.browserInit).not.toHaveBeenCalled();
    expect(mocks.clear).toHaveBeenCalled();
  });
});
it('does not initialize a changed project when old diagnostic cache cannot be cleared', async () => {
  vi.mocked(localStorage.getItem).mockReturnValue('old-dsn');
  mocks.clear.mockRejectedValueOnce(new Error('cache locked'));
  await expect(start(config, () => true)).rejects.toThrow('cache locked');
  expect(mocks.init).not.toHaveBeenCalled();
  expect(localStorage.setItem).not.toHaveBeenCalled();
});
it('reuses one browser offline transport across off/on cycles', async () => {
  const instance = { send: vi.fn(), flush: vi.fn() };
  mocks.offline.mockReturnValueOnce(vi.fn(() => instance));
  await start(config, () => true);
  const first = mocks.init.mock.calls[0][0] as CapacitorOptions;
  const transport = first.transport!({} as never);
  await stop();
  await start(config, () => true);
  const second = mocks.init.mock.calls[1][0] as CapacitorOptions;
  expect(second.transport!({} as never)).toBe(transport);
  expect(mocks.offline).toHaveBeenCalledTimes(1);
});

it('rejects Android browser-only fallback and contains asynchronous browser initialization errors', async () => {
  mocks.platform.mockReturnValue('android');
  mocks.init.mockImplementation((options, original) => original({ ...options, transport: undefined }));
  await expect(start(config, () => true)).rejects.toThrow('Native error reporting unavailable');
  expect(mocks.browserInit).not.toHaveBeenCalled();
  mocks.platform.mockReturnValue('web');
  mocks.browserInit.mockImplementationOnce(() => { throw new Error('browser SDK failed'); });
  await expect(start(config, () => true)).rejects.toThrow('browser SDK failed');
});
