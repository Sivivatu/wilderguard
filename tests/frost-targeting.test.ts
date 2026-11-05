import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { buildTower, createGame, PATH_LENGTH, pointOnPath, startWave, tickGame, towerStats, type Enemy, type GameState, type TowerType } from '../src/game';
import { defenseGuide, towerSummary } from '../src/defense-guide';

beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0));
afterEach(() => vi.restoreAllMocks());

function enemy(id: number, changes: Partial<Enemy> = {}): Enemy {
  return { id, distance: 480, hp: 100, maxHp: 100, speed: 0, kind: 'clubber', slow: 0, ...changes };
}

function wave(enemies: Enemy[], type: TowerType = 'frost', level = 1): GameState {
  const state = startWave(buildTower(createGame(0, 1000), 1, type));
  return { ...state, enemies, towers: state.towers.map(tower => ({ ...tower, level })) };
}

test('Frost prefers an unchilled enemy over the first chilled enemy in range', () => {
  const state = wave([enemy(1, { slow: 2 }), enemy(2, { distance: 500 })]);
  const result = tickGame(state, .1);
  expect(result.enemies[0].hp).toBe(100);
  expect(result.enemies[1]).toMatchObject({ hp: 92, slow: 2 });
  expect(state.enemies[1]).toMatchObject({ hp: 100, slow: 0 });
});

test('a newly arriving unchilled enemy becomes preferred on the next ready shot', () => {
  let state = wave([enemy(1), enemy(2, { distance: 170, speed: 100 })]);
  state = tickGame(state, .1); // Only the first enemy is in range; it becomes chilled.
  expect(state.enemies[0].slow).toBe(2);
  expect(state.enemies[1].hp).toBe(100);
  let steps = 0;
  while (state.enemies[1].hp === 100 && steps++ < 15) state = tickGame(state, .1);
  expect(state.enemies[0].hp).toBe(92);
  expect(state.enemies[1]).toMatchObject({ hp: 92, slow: 2 });
  expect(state.shots[state.shots.length - 1]?.to).toEqual(pointOnPath(state.enemies[1].distance));
});

test('Frost keeps firing when every enemy in range is chilled', () => {
  const result = tickGame(wave([enemy(1, { slow: 2 }), enemy(2, { slow: 2 })]), .1);
  expect(result.enemies.map(mob => mob.hp)).toEqual([92, 100]);
});

test('untreated enemies that are dead, waiting, escaped or out of range are excluded', () => {
  const result = tickGame(wave([enemy(1, { slow: 2 }), enemy(2, { hp: 0 }),
    enemy(3, { distance: -5 }), enemy(4, { distance: PATH_LENGTH }), enemy(5, { distance: 0 })]), .1);
  expect(result.enemies.find(mob => mob.id === 1)?.hp).toBe(92);
  expect(result.enemies.filter(mob => mob.id === 3 || mob.id === 5).every(mob => mob.hp === 100)).toBe(true);
});

test('a chill that has expired is eligible for preference again', () => {
  const result = tickGame(wave([enemy(1, { slow: 2 }), enemy(2, { slow: .05 })]), .1);
  expect(result.enemies[1]).toMatchObject({ hp: 92, slow: 2 });
});

test.each(['archer', 'cannon'] as const)('%s keeps its existing target order', type => {
  const result = tickGame(wave([enemy(1, { slow: 2 }), enemy(2, { distance: 600 })], type), .1);
  expect(result.enemies.map(mob => mob.hp)).toEqual([100 - towerStats(type, 1).damage, 100]);
});

test.each([0, .849999, .85, .999999])('Frost applies chill only below the 85 percent chance boundary (roll %s)', roll => {
  vi.mocked(Math.random).mockReturnValue(roll);
  const result = tickGame(wave([enemy(1)], 'frost', 3), .1);
  expect(result.enemies[0].hp).toBeCloseTo(80.8);
  expect(result.enemies[0].slow).toBe(roll < .85 ? 2 : 0);
  expect(result.enemies[0].frostNovaTime ?? 0).toBe(roll < .85 ? 2 : 0);
  expect(Math.random).toHaveBeenCalledTimes(1);
});

test('a failed Frost hit preserves remaining chill and nova duration without refreshing them', () => {
  vi.mocked(Math.random).mockReturnValue(.9);
  const result = tickGame(wave([enemy(1, { slow: 1, frostNovaTime: .7 })], 'frost', 3), .1);
  expect(result.enemies[0].slow).toBeCloseTo(.9);
  expect(result.enemies[0].frostNovaTime).toBeCloseTo(.6);
});

test('a failed lethal level 3 hit does not cause a nova', () => {
  vi.mocked(Math.random).mockReturnValue(.9);
  const result = tickGame(wave([enemy(1, { hp: 1 }), enemy(2, { distance: 530 })], 'frost', 3), .1);
  expect(result.kills).toBe(1);
  expect(result.frostBursts).toEqual([]);
  expect(result.enemies[0].slow).toBe(0);
});

test('multiple Frost towers distribute successful chills within the same tick', () => {
  const state = wave([enemy(1, { distance: 400 }), enemy(2, { distance: 420 })]);
  const second = buildTower(createGame(0, 1000), 2, 'frost').towers[0];
  const result = tickGame({ ...state, towers: [...state.towers, second] }, .1);
  expect(result.enemies.map(mob => mob.hp)).toEqual([92, 92]);
  expect(result.enemies.every(mob => mob.slow === 2)).toBe(true);
});

test('Deep Freeze does not prevent choosing an enemy without a tower chill', () => {
  const state = { ...wave([enemy(1, { slow: 2 }), enemy(2)]), freezeTime: 6 };
  const result = tickGame(state, .1);
  expect(result.enemies.map(mob => mob.hp)).toEqual([100, 92]);
  expect(result.freezeTime).toBe(5.9);
});

test('tower details state the actual chance, failure rate and targeting preference', () => {
  const guide = defenseGuide(0);
  expect(guide).toContain('85% chance');
  expect(guide).toContain('15%');
  expect(guide).toContain('not already chilled');
  expect(towerSummary('frost', 1)).toContain('85% chill');
});
