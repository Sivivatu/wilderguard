import { describe, expect, it } from 'vitest';
import { telemetryEventSchema } from '../src/telemetry-contract';
import { startEvent } from './telemetry-fixture';
describe('telemetry allowlist', () => {
  it('accepts a versioned bounded snapshot', () => expect(telemetryEventSchema.parse(startEvent)).toEqual(startEvent));
  it.each([{ name: 'Eric' }, { save: {} }, { intervalMs: Infinity }, { region: 5 }, { build: '<script>' }, { version: 2 }])('rejects extra or invalid game facts %o', extra => {
    expect(telemetryEventSchema.safeParse({ ...startEvent, ...extra }).success).toBe(false);
  });
});
