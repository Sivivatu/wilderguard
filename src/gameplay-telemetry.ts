import type { GameState } from './game';
import { randomId, type TelemetryEvent } from './telemetry-contract';
const SLOW_FRAME_MS = 33.34;
const SAMPLE_EVERY_FRAMES = 30;
type Context = TelemetryEvent['context'];
interface Options { build: string; enabled(): boolean; emit(event: TelemetryEvent): void }
interface Attempt {
  start: Extract<TelemetryEvent, { kind: 'wave_start' }>; openingKills: number;
  earned: number; spent: number; livesLost: number; activeMs: number;
  samples: number; slow: number; intervalTotal: number; intervalMax: number; updateTotal: number; renderTotal: number;
}
function composition(state: GameState) {
  const count = (type: string, level: number) => state.towers.filter(t => t.type === type && t.level === level).length;
  return { archer1: count('archer', 1), archer2: count('archer', 2), archer3: count('archer', 3),
    cannon1: count('cannon', 1), cannon2: count('cannon', 2), cannon3: count('cannon', 3),
    frost1: count('frost', 1), frost2: count('frost', 2), frost3: count('frost', 3) };
}
export function createGameplayCollector({ build, enabled, emit }: Options) {
  let runId: string | null = null;
  let active: Attempt | null = null;
  let context: Context = 'fresh';
  let number = 0;
  let preparationSpent = 0;
  let paused = false;
  let skipFrame = true;
  let frameNumber = 0;
  function start(state: GameState) {
    try { runId ??= randomId(); } catch { return; }
    if (context !== 'retry') number = 0;
    number += 1;
    const event: Extract<TelemetryEvent, { kind: 'wave_start' }> = { version: 1, kind: 'wave_start', id: randomId(), runId,
      attemptId: randomId(), at: Date.now(), build, balance: 'campaign-v1', difficulty: 'campaign',
      region: state.regionIndex, wave: state.wave, context, attemptNumber: number,
      preparationSpent, livesRemaining: state.lives, diamondsRemaining: state.diamonds, ...composition(state) };
    active = { start: event, openingKills: state.kills, earned: 0, spent: 0, livesLost: 0, activeMs: 0,
      samples: 0, slow: 0, intervalTotal: 0, intervalMax: 0, updateTotal: 0, renderTotal: 0 };
    skipFrame = true; frameNumber = 0; emit(event);
  }
  function finish(state: GameState, outcome: 'clear' | 'defeat' | 'abandon') {
    const attempt = active;
    if (!attempt) return;
    active = null;
    emit({ ...attempt.start, ...composition(state), kind: 'wave_end', id: randomId(), at: Date.now(), outcome,
      openingDiamonds: attempt.start.diamondsRemaining, livesRemaining: state.lives, diamondsRemaining: state.diamonds,
      livesLost: attempt.livesLost, kills: Math.max(0, state.kills - attempt.openingKills), earned: attempt.earned, spent: attempt.spent,
      activeMs: Math.round(attempt.activeMs), frameSamples: attempt.samples, slowFrames: attempt.slow,
      intervalMeanMs: attempt.samples ? attempt.intervalTotal / attempt.samples : 0, intervalMaxMs: attempt.intervalMax,
      updateMeanMs: attempt.samples ? attempt.updateTotal / attempt.samples : 0, renderMeanMs: attempt.samples ? attempt.renderTotal / attempt.samples : 0 });
    preparationSpent = 0; context = 'next';
  }
  return {
    transition(before: GameState, after: GameState) {
      if (!enabled()) { active = null; preparationSpent = 0; return; }
      if (before === after) return;
      if (before.phase !== 'wave' && after.phase === 'wave') { start(after); return; }
      const delta = after.diamonds - before.diamonds;
      if (!active) { preparationSpent += Math.max(0, -delta); return; }
      active = { ...active, earned: active.earned + Math.max(0, delta), spent: active.spent + Math.max(0, -delta),
        livesLost: active.livesLost + Math.max(0, before.lives - after.lives) };
      if (before.phase === 'wave' && after.phase !== 'wave') finish(after, after.phase === 'defeat' ? 'defeat' : 'clear');
    },
    shouldSample: () => !!active && !paused && frameNumber % SAMPLE_EVERY_FRAMES === 0,
    frame(intervalMs: number, updateMs?: number, renderMs?: number) {
      if (!active || paused || !enabled()) return;
      frameNumber += 1;
      if (skipFrame) { skipFrame = false; return; }
      if (!Number.isFinite(intervalMs) || intervalMs < 0) return;
      active = { ...active, activeMs: Math.min(86_400_000, active.activeMs + intervalMs) };
      if (updateMs === undefined || renderMs === undefined) return;
      active = { ...active, samples: active.samples + 1, slow: active.slow + Number(intervalMs > SLOW_FRAME_MS),
        intervalTotal: active.intervalTotal + intervalMs, intervalMax: Math.max(active.intervalMax, intervalMs),
        updateTotal: active.updateTotal + updateMs, renderTotal: active.renderTotal + renderMs };
    },
    setPaused(value: boolean) { if (paused !== value) skipFrame = true; paused = value; },
    retry() { context = 'retry'; preparationSpent = 0; },
    restore() { context = 'checkpoint'; },
    abandon(state: GameState) { if (enabled()) finish(state, 'abandon'); },
    reset() { active = null; runId = null; context = 'fresh'; number = 0; preparationSpent = 0; },
  };
}
