import { createReportingController } from './error-reporting';
import { readReportingConfig } from './error-policy';
import { beginStartupCapture, discardStartupCapture } from './startup-errors';
import { clearReportingCaches } from './reporting-storage';

const config = readReportingConfig(import.meta.env);
export const reporting = createReportingController(config, {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}, () => import('./sentry-client'), clearReportingCaches);

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
  notice.innerHTML = `<h2>Automatic error reports</h2>${reportingSettings()}<button class="primary-button" id="continue-from-privacy">Continue playing</button>`;
  document.body.append(notice);
  notice.showModal();
  const acknowledge = () => {
    try { localStorage.setItem(NOTICE_KEY, config.dsn); } catch { /* Notice can appear again if storage is blocked. */ }
    notice.close(); notice.remove();
  };
  notice.querySelector('#continue-from-privacy')?.addEventListener('click', acknowledge);
  notice.querySelector('#toggle-error-reporting')?.addEventListener('click', () => {
    void reporting.setEnabled(!reporting.isEnabled()).then(acknowledge);
  });
}
