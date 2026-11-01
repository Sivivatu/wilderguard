import { expect, test } from 'vitest';
import {
  advanceRegion, buildTower, createGame, FROST_NOVA, PATH_LENGTH, startWave, tickGame,
  upgradeTower, useSpell, type Enemy, type GameState,
} from '../src/game';
import { decodeSave, encodeSave } from '../src/save';

function prepareEnemy(
  { distance, hp = 100, slow = 0, frostNovaTime = undefined }: Partial<Enemy> & Pick<Enemy, 'distance'>,
  id: number,
): Enemy {
  return { id, distance, hp, maxHp: hp, speed: 41, kind: 'clubber', slow, frostNovaTime };
}

function waveWith(...enemies: Enemy[]): GameState {
  return { ...startWave(createGame()), enemies };
}

function buildLevelThreeFrost(state = createGame(), slotId = 1) {
  state = createGame(state.regionIndex, 1000);
  const built = buildTower(state, slotId, 'frost');
  return upgradeTower(upgradeTower(built, built.towers[0].id), built.towers[0].id);
}

test('a level 3 frost hit marks its target for a short time and uses the real frost slow', () => {
  const towerState = buildLevelThreeFrost();
  const enemy = prepareEnemy({ distance: 480, hp: 100 }, 1);
  const wave = waveWith(enemy);
  const result = tickGame({ ...wave, towers: towerState.towers }, 0.1);

  expect(result.enemies[0].slow).toBe(2);
  expect(result.enemies[0].frostNovaTime).toBe(2);
  expect(result.frostBursts).toEqual([]);
  expect(enemy.frostNovaTime).toBeUndefined();
});

test('any tower kill of a live level 3 frost mark bursts and slows nearby enemies without dealing damage', () => {
  let state = buildLevelThreeFrost();
  const archer = buildTower(createGame(0, 1000), 2, 'archer').towers[0];
  state = { ...state, towers: [...state.towers, archer] };
  const target = prepareEnemy({ distance: 480, hp: 30 }, 1);
  const nearby = prepareEnemy({ distance: 530 }, 2);
  const distant = prepareEnemy({ distance: 600 }, 3);
  let wave = { ...waveWith(target, nearby, distant), towers: state.towers.map(tower => tower.type === 'archer' ? { ...tower, cooldown: 1 } : tower) };

  wave = tickGame(wave, 0.1); // Frost marks and damages the target; the archer is cooling down.
  const markedHp = wave.enemies.find(enemy => enemy.id === target.id)!.hp;
  expect(markedHp).toBeGreaterThan(0);
  wave = { ...wave, towers: wave.towers.map(tower => tower.type === 'archer' ? { ...tower, cooldown: 0 } : tower) };
  wave = tickGame(wave, 0.1); // The archer kills the marked target.

  expect(wave.kills).toBe(1);
  expect(wave.frostBursts).toHaveLength(1);
  expect(wave.frostBursts[0].position).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  expect(wave.enemies.find(enemy => enemy.id === nearby.id)?.slow).toBeGreaterThan(0);
  expect(wave.enemies.find(enemy => enemy.id === nearby.id)?.frostNovaTime).toBeGreaterThan(0);
  expect(wave.enemies.find(enemy => enemy.id === nearby.id)?.hp).toBe(nearby.hp);
  expect(wave.enemies.find(enemy => enemy.id === distant.id)?.slow ?? 0).toBe(0);
  expect(wave.enemies.find(enemy => enemy.id === distant.id)?.hp).toBe(distant.hp);
  expect(wave.frostBursts[0].life).toBe(FROST_NOVA.life);
});

test('a frost mark spreads when Starfall kills its target', () => {
  const towerState = buildLevelThreeFrost();
  const wave = waveWith(
    prepareEnemy({ distance: 480, hp: 100 }, 1),
    prepareEnemy({ distance: 530, hp: 300 }, 2),
  );
  const marked = tickGame({ ...wave, towers: towerState.towers }, 0.1);
  const withSpell = useSpell({ ...marked, enemies: marked.enemies.map(enemy => ({ ...enemy, hp: enemy.id === 1 ? 1 : enemy.hp })) }, 'meteor');
  const resolved = tickGame(withSpell, 0.1);

  expect(resolved.kills).toBe(1);
  expect(resolved.frostBursts).toHaveLength(1);
  expect(resolved.enemies.find(enemy => enemy.id === 2)?.slow).toBeGreaterThan(0);
});

test.each([1, 2])('level %i frost slows do not carry the level 3 death effect', level => {
  let state = buildLevelThreeFrost();
  state = { ...state, towers: [{ ...state.towers[0], level }] };
  const wave = waveWith(prepareEnemy({ distance: 480, hp: 10 }, 1), prepareEnemy({ distance: 530 }, 2));
  const result = tickGame({ ...wave, towers: state.towers }, 0.1);

  expect(result.enemies.find(enemy => enemy.id === 2)?.slow ?? 0).toBe(0);
  expect(result.frostBursts).toEqual([]);
});

test('a burst includes the radius boundary but excludes enemies just beyond it', () => {
  const wave = waveWith(
    prepareEnemy({ distance: 100, hp: 1, frostNovaTime: 2, slow: 2 }, 1),
    prepareEnemy({ distance: 190, hp: 300 }, 2),
    prepareEnemy({ distance: 190.1, hp: 300 }, 3),
  );
  const result = useSpell(wave, 'meteor');
  expect(result.enemies.find(enemy => enemy.id === 2)?.slow).toBe(2);
  expect(result.enemies.find(enemy => enemy.id === 3)?.slow).toBe(0);
  expect(wave.enemies[1].slow).toBe(0);
});

test('simultaneous marked deaths produce the same spread regardless of enemy order', () => {
  const wave = waveWith(
    prepareEnemy({ distance: 480, hp: 1, frostNovaTime: 2, slow: 2 }, 1),
    prepareEnemy({ distance: 530, hp: 1, frostNovaTime: 2, slow: 2 }, 2),
    prepareEnemy({ distance: 560, hp: 300 }, 3),
  );
  const forward = useSpell(wave, 'meteor');
  const reverse = useSpell({ ...wave, enemies: [...wave.enemies].reverse() }, 'meteor');
  expect(forward.frostBursts).toHaveLength(2);
  expect(forward.enemies.find(enemy => enemy.id === 3)).toEqual(reverse.enemies.find(enemy => enemy.id === 3));
  const resolved = tickGame(forward, .1);
  expect(resolved.kills).toBe(2);
  expect(resolved.frostBursts).toHaveLength(2);
});

test('Deep Freeze by itself does not grant the contagious chill', () => {
  const archer = buildTower(createGame(0, 1000), 2, 'archer').towers;
  const wave = waveWith(prepareEnemy({ distance: 480, hp: 1 }, 1), prepareEnemy({ distance: 530 }, 2));
  const frozen = useSpell({ ...wave, towers: archer }, 'freeze');
  const result = tickGame(frozen, .1);
  expect(result.kills).toBe(1);
  expect(result.frostBursts).toEqual([]);
});

test('the last death burst fades between waves and a region move clears it', () => {
  const state = buildLevelThreeFrost();
  const result = tickGame({ ...waveWith(prepareEnemy({ distance: 480, hp: 1 }, 1)), towers: state.towers }, .1);
  expect(result.phase).toBe('reward');
  let faded = result;
  for (let i = 0; i < 7; i += 1) faded = tickGame(faded, .1);
  expect(faded.frostBursts).toEqual([]);
  expect(advanceRegion({ ...result, phase: 'victory', wave: 5 }).frostBursts).toEqual([]);
  const restored = decodeSave(encodeSave(result));
  expect(restored?.frostBursts).toEqual([]);
  expect(restored?.towers[0].level).toBe(3);
});

test('a level 3 mark expires before death and no longer bursts', () => {
  const state = buildLevelThreeFrost();
  const marked = { ...prepareEnemy({ distance: 480, hp: 100 }, 1), frostNovaTime: 0.05, slow: 0.05 };
  const archer = buildTower(createGame(0, 1000), 2, 'archer').towers[0];
  const wave = waveWith({ ...marked, hp: 1 }, prepareEnemy({ distance: 530 }, 2));
  const result = tickGame({ ...wave, towers: [{ ...state.towers[0], cooldown: 1 }, archer] }, 0.1);

  expect(result.kills).toBe(1);
  expect(result.frostBursts).toEqual([]);
  expect(result.enemies.find(enemy => enemy.id === 2)?.slow ?? 0).toBe(0);
});

test('a new level 3 hit can mark a target that it kills immediately', () => {
  const state = buildLevelThreeFrost();
  const wave = waveWith(prepareEnemy({ distance: 480, hp: 1 }, 1), prepareEnemy({ distance: 530 }, 2));
  const result = tickGame({ ...wave, towers: state.towers }, 0.1);

  expect(result.kills).toBe(1);
  expect(result.frostBursts).toHaveLength(1);
  expect(result.enemies[0].slow).toBeGreaterThan(0);
});

test('a chained victim can burst again when it dies while its inherited mark is active', () => {
  const state = buildLevelThreeFrost();
  const wave = waveWith(prepareEnemy({ distance: 480, hp: 1 }, 1), prepareEnemy({ distance: 530, hp: 300 }, 2), prepareEnemy({ distance: 560, hp: 300 }, 3));
  const archer = buildTower(createGame(0, 1000), 8, 'archer').towers[0];
  let first = tickGame({ ...wave, towers: [...state.towers, { ...archer, cooldown: 1 }] }, 0.1);
  const markedNeighbor = first.enemies.find(enemy => enemy.id === 2)!;
  first = { ...first, towers: first.towers.map(tower => tower.type === 'archer' ? { ...tower, cooldown: 0 } : tower), enemies: first.enemies.map(enemy => enemy.id === 2 ? { ...enemy, hp: 1 } : enemy) };
  const second = tickGame(first, 0.1);

  expect(first.frostBursts).toHaveLength(1);
  expect(markedNeighbor.frostNovaTime).toBeGreaterThan(0);
  expect(second.kills).toBe(2);
  expect(second.frostBursts).toHaveLength(2);
  expect(second.enemies.find(enemy => enemy.id === 3)?.slow).toBeGreaterThan(0);
  const later = tickGame(second, 0.1);
  expect(later.kills).toBe(2);
  expect(later.frostBursts).toHaveLength(2);
});

test('dead, escaped, and not-yet-arrived enemies do not receive a burst slow', () => {
  const state = buildLevelThreeFrost();
  const escapedDistance = PATH_LENGTH + 2;
  const wave = waveWith(
    prepareEnemy({ distance: 480, hp: 1 }, 1),
    prepareEnemy({ distance: -30 }, 2),
    prepareEnemy({ distance: escapedDistance, hp: 90 }, 3),
    prepareEnemy({ distance: 530, hp: 0 }, 4),
  );
  const result = tickGame({ ...wave, towers: state.towers }, 0.1);

  expect(result.enemies.find(enemy => enemy.id === 2)?.slow ?? 0).toBe(0);
  expect(result.enemies.find(enemy => enemy.id === 3)).toBeUndefined();
  expect(result.enemies.find(enemy => enemy.id === 4)).toBeUndefined();
});

test('a burst plays and expires without carrying into the next wave or region', () => {
  const state = buildLevelThreeFrost();
  const wave = waveWith(prepareEnemy({ distance: 480, hp: 1 }, 1), prepareEnemy({ distance: 530 }, 2));
  const burst = tickGame({ ...wave, towers: state.towers }, 0.1);
  let expired: GameState = { ...burst, towers: [], enemies: [prepareEnemy({ distance: 100 }, 3)] };
  for (let frame = 0; frame < 7; frame += 1) expired = tickGame(expired, 0.1);

  expect(burst.frostBursts).toHaveLength(1);
  expect(expired.frostBursts).toEqual([]);
  expect(startWave({ ...burst, phase: 'reward', wave: 1, enemies: [], frostBursts: burst.frostBursts }).frostBursts).toEqual([]);
});
