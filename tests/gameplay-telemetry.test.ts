import { describe, expect, it } from 'vitest';
import { buildTower, createGame, startWave, useSpell } from '../src/game';
import { createGameplayCollector } from '../src/gameplay-telemetry';
import type { TelemetryEvent } from '../src/telemetry-contract';
function fixture(enabled = true) {
  const events: TelemetryEvent[] = [];
  const collector = createGameplayCollector({ build: 'beta-test', enabled: () => enabled, emit: e => events.push(e) });
  return { collector, events };
}
describe('wave attempts', () => {
  it('captures a clear once with real economic deltas, healing and composition', () => {
    const { collector: c, events } = fixture();
    const fresh = createGame(); const built = buildTower(fresh, 1, 'archer');
    c.transition(fresh, built);
    const wave = startWave(built); c.transition(built, wave); c.transition(wave, wave);
    c.frame(16, 2, 3); c.frame(40, 4, 5);
    c.setPaused(true); c.frame(10000, 4, 5); c.setPaused(false); c.frame(20000, 4, 5); c.frame(20, 2, 3);
    const damaged = { ...wave, lives: 16 }; c.transition(wave, damaged);
    const healed = useSpell(damaged, 'heal'); c.transition(damaged, healed);
    const spent = { ...healed, diamonds: 20 }; c.transition(healed, spent);
    const cleared = { ...spent, phase: 'reward' as const, diamonds: 90 }; c.transition(spent, cleared); c.transition(spent, cleared);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'wave_start', preparationSpent: 70, archer1: 1 });
    expect(events[1]).toMatchObject({ kind: 'wave_end', outcome: 'clear', livesLost: 4, livesRemaining: 20, earned: 70, spent: 30, diamondsRemaining: 90, activeMs: 60, frameSamples: 2, slowFrames: 1 });
    expect(events[1].attemptId).toBe(events[0].attemptId);
  });
  it('distinguishes retry, checkpoint restore, explicit abandon, and missing terminal', () => {
    const { collector: c, events } = fixture();
    const ready = buildTower(createGame(), 1, 'archer'); const wave = startWave(ready);
    c.transition(ready, wave); c.transition(wave, { ...wave, phase: 'defeat', lives: 0 });
    c.retry(); c.transition(ready, wave);
    expect(events[events.length - 1]).toMatchObject({ context: 'retry', attemptNumber: 2 });
    c.abandon(wave); c.abandon(wave);
    expect(events.filter(e => e.kind === 'wave_end')).toHaveLength(2);
    const restored = fixture(); restored.collector.restore(); restored.collector.transition(ready, wave);
    expect(restored.events).toHaveLength(1);
    expect(restored.events[0]).toMatchObject({ context: 'checkpoint', attemptNumber: 1 });
    c.reset(); c.transition(wave, { ...wave, phase: 'reward' }); expect(events).toHaveLength(4);
  });
  it('collects nothing while disabled and never starts an attempt halfway through a wave', () => {
    const { collector: c, events } = fixture(false); const ready = createGame(); const wave = startWave(ready);
    c.transition(ready, wave); c.frame(20, 1, 1); c.abandon(wave); expect(events).toEqual([]);
  });
});
