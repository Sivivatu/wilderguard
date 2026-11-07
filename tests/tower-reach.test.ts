import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { buildTower, createGame, pointOnPath, REGIONS, SLOTS, startWave, tickGame, TOWER_TYPES, towerStats, WAVES_PER_REGION, type TowerType } from '../src/game';
import { pathLengthForRegion } from '../src/region-geometry';

const STEP_SECONDS = .05;
const PATH_SAMPLE_UNITS = 1;
const cases = REGIONS.flatMap((region, regionIndex) => SLOTS.flatMap(slot =>
  (Object.keys(TOWER_TYPES) as TowerType[]).map(type => ({ region: region.name, regionIndex, slot, type }))));

beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(.999999));
afterEach(() => vi.restoreAllMocks());

function longestFiringWindow(regionIndex: number, slot: typeof SLOTS[number], range: number) {
  let start = 0;
  let wasInRange = false;
  let best = { start: 0, end: 0 };
  for (let distance = 0; distance <= pathLengthForRegion(regionIndex); distance += PATH_SAMPLE_UNITS) {
    const point = pointOnPath(distance, regionIndex);
    const isInRange = Math.hypot(point.x - slot.x, point.y - slot.y) <= range;
    if (isInRange && !wasInRange) start = distance;
    if (isInRange && distance - start > best.end - best.start) best = { start, end: distance };
    wasInRange = isInRange;
  }
  return best;
}

test.each(cases)('$region: pad $slot.id gives a level 1 $type useful reach and real damage', ({ regionIndex, slot, type }) => {
  const wave = startWave({ ...buildTower(createGame(regionIndex, 1000), slot.id, type), wave: WAVES_PER_REGION - 1 });
  const fastestMob = wave.enemies.reduce((fastest, mob) => mob.speed > fastest.speed ? mob : fastest);
  const stats = towerStats(type, 1);
  const window = longestFiringWindow(regionIndex, slot, stats.range);
  const secondsInRange = (window.end - window.start) / fastestMob.speed;
  // In a busy wave the previous shot may have just fired. Require two further
  // opportunities without relying on Frost's slow to keep the next mob in range.
  expect(secondsInRange).toBeGreaterThanOrEqual(2 * stats.interval + 2 * STEP_SECONDS);
  let state = { ...wave, enemies: [{ ...fastestMob, distance: window.start }],
    towers: wave.towers.map(tower => ({ ...tower, cooldown: stats.interval })) };
  let hits = 0;
  const maxSteps = Math.ceil(secondsInRange / STEP_SECONDS) + 1;
  for (let step = 0; step < maxSteps && state.phase === 'wave'; step += 1) {
    const previousHp = state.enemies[0].hp;
    const result = tickGame(state, STEP_SECONDS);
    if ((result.enemies[0]?.hp ?? previousHp) < previousHp || result.kills > state.kills) {
      hits += 1;
      const shot = result.shots[result.shots.length - 1];
      expect(shot?.type).toBe(type);
      expect(Math.hypot(shot.to.x - slot.x, shot.to.y - slot.y)).toBeLessThanOrEqual(stats.range);
    }
    state = result;
    if (hits >= 2 || !state.enemies.length || state.enemies[0].distance > window.end) break;
  }
  expect(hits).toBeGreaterThanOrEqual(2);
  expect(wave.enemies.find(mob => mob.id === fastestMob.id)?.hp).toBe(fastestMob.hp);
});
