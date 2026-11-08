import type { TelemetryEvent } from '../src/telemetry-contract.ts';
export type GameAnalyticsRow = Record<string, string | number | boolean>;
const METRICS = ['livesLost', 'activeMs', 'diamondsRemaining', 'intervalMeanMs', 'updateMeanMs', 'renderMeanMs',
  'archer1', 'archer2', 'archer3', 'cannon1', 'cannon2', 'cannon3', 'frost1', 'frost2', 'frost3'] as const;
/** No hardware probing, ad identifiers, custom fields, custom dimensions or paid health events. */
export function mapGameAnalyticsEvent(event: TelemetryEvent, includeSession: boolean): GameAnalyticsRow[] {
  const common = { v: 2, user_id: event.runId, session_id: event.runId, session_num: 1,
    client_ts: Math.floor(event.at / 1000), sdk_version: 'rest api v2',
    platform: 'webgl', os_version: 'webgl 0', device: 'unknown', manufacturer: 'unknown', limit_ad_tracking: true, build: event.build.slice(0, 32) };
  const region = `r${event.region + 1}`; const wave = `w${event.wave}`;
  const session = includeSession ? [{ ...common, category: 'user' }] : [];
  if (event.kind === 'wave_start') return [...session, { ...common, category: 'progression', event_id: `Start:${region}:${wave}` }];
  const outcome: GameAnalyticsRow = event.outcome === 'abandon'
    ? { ...common, category: 'design', event_id: `wg1:abandon:${region}:${wave}`, value: 1 }
    : { ...common, category: 'progression', event_id: `${event.outcome === 'clear' ? 'Complete' : 'Fail'}:${region}:${wave}`, attempt_num: event.attemptNumber, score: event.livesRemaining };
  const metrics = METRICS.map(metric => ({ ...common, category: 'design', event_id: `wg1:${metric}:${region}:${wave}:${event.outcome}`, value: event[metric] }));
  const resources = [
    ...(event.earned > 0 ? [{ ...common, category: 'resource', event_id: `Source:Diamonds:Wave:${region}${wave}`, amount: event.earned }] : []),
    ...(event.spent + event.preparationSpent > 0 ? [{ ...common, category: 'resource', event_id: `Sink:Diamonds:Wave:${region}${wave}`, amount: -(event.spent + event.preparationSpent) }] : []),
  ];
  return [...session, outcome, ...metrics, ...resources];
}
