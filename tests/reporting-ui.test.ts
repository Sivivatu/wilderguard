import { afterEach, expect, it, vi } from 'vitest';

const clear = vi.hoisted(() => vi.fn());
vi.mock('../src/reporting-storage', () => ({ clearReportingCaches: clear }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

it('shows unavailable in settings when opt-out cannot remove cached reports', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o123.ingest.de.sentry.io/456');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'beta');
  vi.stubEnv('VITE_SENTRY_RELEASE', 'com.wilderguard.game.beta@0.1.0-beta.8+8');
  vi.stubEnv('VITE_SENTRY_DIST', '8');
  const preferences = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => preferences.get(key) ?? null, setItem: (key: string, value: string) => { preferences.set(key, value); } });
  clear.mockRejectedValueOnce(new Error('cache locked'));
  const { reporting, reportingSettings } = await import('../src/reporting');
  await reporting.setEnabled(false);
  expect(preferences.get('wilderguard-error-reporting-v1')).toBe('off');
  expect(reportingSettings()).toContain('<strong>Unavailable</strong>');
});

it('keeps the privacy notice open and shows unavailable if opt-out cleanup fails', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o123.ingest.de.sentry.io/456');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'beta');
  vi.stubEnv('VITE_SENTRY_RELEASE', 'com.wilderguard.game.beta@0.1.0-beta.8+8');
  vi.stubEnv('VITE_SENTRY_DIST', '8');
  const preferences = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => preferences.get(key) ?? null, setItem: (key: string, value: string) => { preferences.set(key, value); } });
  const label = { textContent: 'On' };
  let toggle!: () => void;
  const button = { disabled: false, addEventListener: (_: string, handler: () => void) => { toggle = handler; }, querySelector: () => label };
  const status = { textContent: '' };
  const dialog = {
    setAttribute: vi.fn(), innerHTML: '', showModal: vi.fn(), close: vi.fn(), remove: vi.fn(),
    querySelector: (selector: string) => selector === '#toggle-error-reporting' ? button : selector === '#reporting-notice-status' ? status : { addEventListener: vi.fn() },
  };
  vi.stubGlobal('document', { createElement: () => dialog, body: { append: vi.fn() } });
  clear.mockRejectedValueOnce(new Error('cache locked')).mockResolvedValueOnce(undefined);
  const { showReportingNotice } = await import('../src/reporting');
  showReportingNotice();
  toggle();
  await vi.waitFor(() => expect(label.textContent).toBe('Unavailable'));
  expect(dialog.close).not.toHaveBeenCalled();
  expect(status.textContent).toContain('try again');
  expect(preferences.get('wilderguard-error-reporting-v1')).toBe('off');
  toggle();
  await vi.waitFor(() => expect(dialog.close).toHaveBeenCalledOnce());
  expect(preferences.get('wilderguard-error-reporting-v1')).toBe('off');
});

it('discards buffered startup errors immediately when reporting is turned off', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o123.ingest.de.sentry.io/456');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'beta');
  vi.stubEnv('VITE_SENTRY_RELEASE', 'com.wilderguard.game.beta@0.1.0-beta.8+8');
  vi.stubEnv('VITE_SENTRY_DIST', '8');
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('window', new EventTarget());
  let finishClear!: () => void;
  clear.mockImplementationOnce(() => new Promise<void>(resolve => { finishClear = resolve; }));
  const { reporting } = await import('../src/reporting');
  const { beginStartupCapture, finishStartupCapture } = await import('../src/startup-errors');
  beginStartupCapture();
  const error = new Event('error');
  Object.assign(error, { error: new Error('private startup data') });
  window.dispatchEvent(error);
  const stopping = reporting.setEnabled(false);
  const capture = vi.fn();
  finishStartupCapture(capture);
  expect(capture).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(finishClear).toBeDefined());
  finishClear();
  await stopping;
});

it('retries a failed opt-out without accidentally enabling reporting', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o123.ingest.de.sentry.io/456');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'beta');
  vi.stubEnv('VITE_SENTRY_RELEASE', 'com.wilderguard.game.beta@0.1.0-beta.8+8');
  vi.stubEnv('VITE_SENTRY_DIST', '8');
  const preferences = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => preferences.get(key) ?? null, setItem: (key: string, value: string) => { preferences.set(key, value); } });
  clear.mockRejectedValueOnce(new Error('cache locked')).mockResolvedValueOnce(undefined);
  const { reporting, toggleReporting } = await import('../src/reporting');
  await toggleReporting();
  expect(reporting.status()).toBe('unavailable');
  expect(preferences.get('wilderguard-error-reporting-v1')).toBe('off');
  await toggleReporting();
  expect(reporting.status()).toBe('off');
  expect(preferences.get('wilderguard-error-reporting-v1')).toBe('off');
});

it('ignores repeated toggles while an opt-out is still clearing reports', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o123.ingest.de.sentry.io/456');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'beta');
  vi.stubEnv('VITE_SENTRY_RELEASE', 'com.wilderguard.game.beta@0.1.0-beta.8+8');
  vi.stubEnv('VITE_SENTRY_DIST', '8');
  const preferences = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => preferences.get(key) ?? null, setItem: (key: string, value: string) => { preferences.set(key, value); } });
  let finishClear!: () => void;
  clear.mockImplementationOnce(() => new Promise<void>(resolve => { finishClear = resolve; }));
  const { reporting, toggleReporting } = await import('../src/reporting');
  const first = toggleReporting();
  const second = toggleReporting();
  expect(second).toBe(first);
  await vi.waitFor(() => expect(finishClear).toBeDefined());
  finishClear();
  await Promise.all([first, second]);
  expect(reporting.status()).toBe('off');
  expect(preferences.get('wilderguard-error-reporting-v1')).toBe('off');
});
