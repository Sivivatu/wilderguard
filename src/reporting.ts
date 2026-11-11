import { createReportingController } from './error-reporting';
import { readReportingConfig } from './error-policy';
import { beginStartupCapture, discardStartupCapture } from './startup-errors';
import { clearReportingCaches } from './reporting-storage';

const config = readReportingConfig(import.meta.env);
const controller = createReportingController(config, {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}, () => import('./sentry-client'), clearReportingCaches);
export const reporting = {
  ...controller,
  setEnabled: async (enabled: boolean) => {
    if (!enabled) discardStartupCapture();
    await controller.setEnabled(enabled);
  },
};

let retryEnabled: boolean | undefined;
let pendingToggle: Promise<void> | undefined;
export function toggleReporting(): Promise<void> {
  if (pendingToggle) return pendingToggle;
  const enabled = retryEnabled ?? !reporting.isEnabled();
  pendingToggle = reporting.setEnabled(enabled).then(() => {
    retryEnabled = reporting.status() === 'unavailable' ? enabled : undefined;
  }).finally(() => { pendingToggle = undefined; });
  return pendingToggle;
}

// Startup never waits on SDK loading, storage, the bridge, or the network.
export function startReporting(): void {
  if (!reporting.isEnabled()) {
    void clearReportingCaches().catch(() => reporting.markUnavailable());
    return;
  }
  beginStartupCapture();
  void reporting.start().then(() => { if (reporting.status() === 'unavailable') discardStartupCapture(); });
}

export function reportingSettings(): string {
  if (!config) return '<p>Automatic error reporting is not configured in this build. Progress stays on this device.</p>';
  const status = reporting.status();
  const label = status === 'unavailable' ? 'Unavailable' : reporting.isEnabled() ? 'On' : 'Off';
  return `<p>Optional error reports go to Sentry: error type, stack locations and app version. No saves, names, screenshots or replay. Sentry receives your network address to deliver reports. Android crash diagnostics may be stored locally while offline. You can turn reporting off at any time. Reports already sent cannot be recalled from this device.</p><button class="setting-row" id="toggle-error-reporting"><span>Automatic error reports</span><strong>${label}</strong></button>`;
}

const NOTICE_KEY = 'wilderguard-error-notice-v1';
export function showReportingNotice(): void {
  if (!config) return;
  try { if (localStorage.getItem(NOTICE_KEY) === config.dsn) return; } catch { return; }
  const notice = document.createElement('dialog');
  notice.setAttribute('aria-label', 'Automatic error reports');
  notice.innerHTML = `<h2>Automatic error reports</h2>${reportingSettings()}<p id="reporting-notice-status" role="status"></p><button class="primary-button" id="continue-from-privacy">Continue playing</button>`;
  document.body.append(notice);
  notice.showModal();
  const acknowledge = () => {
    try { localStorage.setItem(NOTICE_KEY, config.dsn); } catch { /* Notice can appear again if storage is blocked. */ }
    notice.close(); notice.remove();
  };
  notice.querySelector('#continue-from-privacy')?.addEventListener('click', acknowledge);
  const toggle = notice.querySelector<HTMLButtonElement>('#toggle-error-reporting');
  toggle?.addEventListener('click', () => {
    if (toggle.disabled) return;
    toggle.disabled = true;
    void toggleReporting().then(() => {
      if (reporting.status() !== 'unavailable') { acknowledge(); return; }
      const label = toggle.querySelector('strong');
      const status = notice.querySelector('#reporting-notice-status');
      if (label) label.textContent = 'Unavailable';
      if (status) status.textContent = 'Could not update error reporting. Please try again.';
      toggle.disabled = false;
    });
  });
}
