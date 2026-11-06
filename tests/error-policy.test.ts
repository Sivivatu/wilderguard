import { describe, expect, it } from 'vitest';
import { readReportingConfig, sanitizeErrorEvent } from '../src/error-policy';

const valid = { VITE_SENTRY_DSN: 'https://abc123@o123.ingest.de.sentry.io/456', VITE_SENTRY_ENVIRONMENT: 'beta', VITE_SENTRY_RELEASE: 'com.wilderguard.game.beta@0.1.0-beta.8+8', VITE_SENTRY_DIST: '8' };
describe('reporting configuration', () => {
  it('defaults to disabled until every deployment decision is configured', () => {
    expect(readReportingConfig({})).toBeNull();
    for (const field of Object.keys(valid)) expect(readReportingConfig({ ...valid, [field]: '' })).toBeNull();
  });
  it('accepts only HTTPS Sentry Cloud DSNs and known policies/environments', () => {
    expect(readReportingConfig(valid)?.environment).toBe('beta');
    for (const dsn of ['http://abc@o123.ingest.de.sentry.io/456', 'https://abc@evil.test/456', 'https://abc:secret@o123.ingest.de.sentry.io/456', 'https://abc@o123.ingest.de.sentry.io/456?token=x']) {
      expect(readReportingConfig({ ...valid, VITE_SENTRY_DSN: dsn })).toBeNull();
    }
    expect(readReportingConfig({ ...valid, VITE_SENTRY_ENVIRONMENT: 'dev' })).toBeNull();
  });
});
describe('error-only privacy boundary', () => {
  it('keeps bounded stack locations and removes arbitrary fields and messages without mutation', () => {
    const input = { event_id: 'a'.repeat(32), user: { email: 'private@example.com' }, message: 'save contents', request: { url: 'https://private/?token=secret' }, extra: { save: 'private' }, breadcrumbs: [{ message: 'private' }], contexts: { replay: { replay_id: 'private' } }, exception: { values: [{ type: 'TypeError', value: 'private@example.com', mechanism: { handled: false, type: 'onerror', data: { private: true } }, stacktrace: { frames: [{ filename: 'https://localhost/assets/main-ab12.js?token=secret', function: 'tickGame', lineno: 12, colno: 34, vars: { save: 'private' }, pre_context: ['source code'] }] } }] } };
    const output = sanitizeErrorEvent(input)!;
    expect(JSON.stringify(output)).not.toMatch(/private|secret|source code|replay|breadcrumbs|extra|user|request/);
    expect(output.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({ filename: 'app:///assets/main-ab12.js', function: 'tickGame', lineno: 12, colno: 34 });
    expect(input.exception.values[0].value).toBe('private@example.com');
  });
  it('drops handled errors and all non-error products', () => {
    expect(sanitizeErrorEvent({ message: 'message' })).toBeNull();
    expect(sanitizeErrorEvent({ type: 'transaction' })).toBeNull();
    expect(sanitizeErrorEvent({ exception: { values: [{ mechanism: { handled: true, type: 'generic' } }] } })).toBeNull();
  });
  it('bounds frames, exceptions, types and removes external paths', () => {
    const event = sanitizeErrorEvent({ exception: { values: Array.from({ length: 9 }, () => ({ type: 'private@example.com', mechanism: { handled: false, type: 'generic' }, stacktrace: { frames: Array.from({ length: 100 }, () => ({ filename: '/home/private/save.json', function: 'private@example.com', lineno: -1 })) } })) } })!;
    expect(event.exception?.values).toHaveLength(3);
    expect(event.exception?.values?.[0].type).toBe('Error');
    expect(event.exception?.values?.[0].stacktrace?.frames).toHaveLength(50);
    expect(JSON.stringify(event)).not.toMatch(/private|save.json/);
  });
});
it('excludes handled exceptions within an otherwise unhandled chain', () => {
  const event = sanitizeErrorEvent({ exception: { values: [
    { type: 'TypeError', mechanism: { handled: false, type: 'onerror' } },
    { type: 'RangeError', mechanism: { handled: true, type: 'generic' } },
  ] } });
  expect(event?.exception?.values).toHaveLength(1);
  expect(event?.exception?.values?.[0].type).toBe('TypeError');
});
