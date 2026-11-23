import { z } from 'zod';

const count = z.number().int().min(0).max(1_000_000);
const duration = z.number().min(0).max(86_400_000).finite();
export const buildSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/);
const towers = {
  archer1: count.max(12), archer2: count.max(12), archer3: count.max(12),
  cannon1: count.max(12), cannon2: count.max(12), cannon3: count.max(12),
  frost1: count.max(12), frost2: count.max(12), frost3: count.max(12),
};
const common = {
  version: z.literal(1), id: z.uuid(), runId: z.uuid(), attemptId: z.uuid(),
  at: z.number().int().min(0).max(8_640_000_000_000_000), build: buildSchema,
  balance: z.literal('campaign-v1'), difficulty: z.literal('campaign'),
  region: count.max(4), wave: count.min(1).max(5),
  context: z.enum(['fresh', 'checkpoint', 'retry', 'next']), attemptNumber: count.min(1),
  livesRemaining: count.max(20), diamondsRemaining: count, preparationSpent: count, ...towers,
};
export const telemetryEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, kind: z.literal('wave_start') }),
  z.strictObject({ ...common, kind: z.literal('wave_end'), outcome: z.enum(['clear', 'defeat', 'abandon']),
    openingDiamonds: count, earned: count, spent: count, livesLost: count, kills: count,
    activeMs: duration, frameSamples: count, slowFrames: count,
    intervalMeanMs: duration, intervalMaxMs: duration, updateMeanMs: duration, renderMeanMs: duration,
  }),
]);
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
export type ProviderChoice = 'off' | 'posthog' | 'gameanalytics';
export type SendResult = 'sent' | 'retry' | 'drop';
export interface TelemetryAdapter {
  choice: Exclude<ProviderChoice, 'off'>;
  /** Includes provider, endpoint, project and credential epoch. Never a player identity. */
  scope: string;
  send(event: TelemetryEvent, signal: AbortSignal): Promise<SendResult>;
}
export interface TelemetryStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }

export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const adjusted = bytes.map((value, i) => i === 6 ? (value & 15) | 64 : i === 8 ? (value & 63) | 128 : value);
  const hex = Array.from(adjusted, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
