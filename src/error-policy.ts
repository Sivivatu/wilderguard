import type { Event, StackFrame } from '@sentry/capacitor';

export const REPORTING_PREFERENCE_KEY = 'wilderguard-error-reporting-v1';
export const REPORT_QUEUE_LIMIT = 10;
export interface ReportingConfig {
  dsn: string;
  environment: 'beta' | 'public';
  release: string;
  dist: string;
  policy: 'automatic';
}

export function readReportingConfig(env: Record<string, unknown>): ReportingConfig | null {
  const { VITE_SENTRY_DSN: dsn, VITE_SENTRY_ENVIRONMENT: environment, VITE_SENTRY_RELEASE: release, VITE_SENTRY_DIST: dist } = env;
  if (typeof dsn !== 'string' || typeof release !== 'string' || typeof dist !== 'string') return null;
  if (!/^com\.wilderguard\.game(?:\.beta)?@[A-Za-z0-9.+-]{1,80}$/.test(release) || !/^\d{1,9}$/.test(dist)) return null;
  if ((environment !== 'beta' && environment !== 'public')) return null;
  try {
    const url = new URL(dsn);
    if (url.protocol !== 'https:' || !/^o\d+\.ingest\.de\.sentry\.io$/.test(url.hostname)) return null;
    if (!/^[a-f0-9]+$/.test(url.username) || url.password || url.port || url.search || url.hash || !/^\/\d+$/.test(url.pathname)) return null;
    return { dsn, release, dist, environment, policy: 'automatic' };
  } catch { return null; }
}

function safeFrame(frame: StackFrame): StackFrame {
  const path = frame.filename?.split(/[?#]/)[0].match(/\/assets\/[A-Za-z0-9_-]+\.js$/)?.[0];
  return {
    ...(path ? { filename: `app://${path}` } : {}),
    ...(frame.function && /^[A-Za-z0-9_.$<> [\]-]{1,120}$/.test(frame.function) ? { function: frame.function } : {}),
    ...(Number.isSafeInteger(frame.lineno) && frame.lineno! > 0 ? { lineno: frame.lineno } : {}),
    ...(Number.isSafeInteger(frame.colno) && frame.colno! > 0 ? { colno: frame.colno } : {}),
  };
}

// Reconstruct an allowlisted event; never forward arbitrary scope or Error properties.
export function sanitizeErrorEvent(event: Event): (Omit<Event, 'type'> & { type: undefined }) | null {
  const values = event.exception?.values?.filter(value => value.mechanism?.handled === false);
  if (event.type || !values?.length) return null;
  return {
    type: undefined,
    ...(event.event_id && /^[a-f0-9]{32}$/.test(event.event_id) ? { event_id: event.event_id } : {}),
    ...(typeof event.timestamp === 'number' && Number.isFinite(event.timestamp) ? { timestamp: event.timestamp } : {}),
    level: 'error',
    platform: 'javascript',
    exception: { values: values.slice(-3).map(value => ({
      type: /^(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError)$/.test(value.type ?? '') ? value.type : 'Error',
      value: '[redacted]',
      mechanism: { handled: false, type: 'unhandled' },
      stacktrace: { frames: (value.stacktrace?.frames ?? []).slice(-50).map(safeFrame) },
    })) },
  };
}
