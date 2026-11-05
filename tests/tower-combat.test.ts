import { describe, expect, it } from 'vitest';
import { buildTower, createGame, repairCost, repairTower, startWave, tickGame, towerMaxHealth, upgradeTower, type Enemy, type GameState } from '../src/game';
import { nearestRegionDistance, pathLengthForRegion } from '../src/region-geometry';
import { deploySoldiers } from '../src/soldiers';

function combat(regionIndex = 0): GameState {
  const state = startWave(buildTower(createGame(regionIndex, 500), 1, 'archer'));
  return { ...state, towers: state.towers.map(tower => ({ ...tower, cooldown: 100 })),
    enemies: [{ id: 900, kind: 'thrower', distance: nearestRegionDistance(regionIndex, 305, 275),
      hp: 500, maxHp: 500, speed: 0, slow: 0 }] };
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe('axe thrower introduction', () => {
  it('keeps the first two Greenfields waves free of tower attackers', () => {
    for (const wave of [0, 1]) {
      expect(startWave({ ...createGame(), wave }).enemies.some(enemy => enemy.kind === 'thrower')).toBe(false);
    }
  });

  it('introduces a thrower in the later spawn group of wave three', () => {
    const wave = startWave({ ...createGame(), wave: 2 });
    const first = wave.enemies.findIndex(enemy => enemy.kind === 'thrower');
    expect(first).toBe(Math.floor(wave.enemies.length / 2));
    expect(wave.enemies[first].distance).toBe(-first * 95);
    expect(-wave.enemies[first].distance / wave.enemies[first].speed).toBeGreaterThan(6);
    expect(wave.enemies.slice(0, first).every(enemy => enemy.kind !== 'thrower')).toBe(true);
  });

  it('retains the chieftain as each region finale and introduces at most two later throwers', () => {
    for (let regionIndex = 0; regionIndex < 5; regionIndex += 1) {
      const finale = startWave({ ...createGame(regionIndex), wave: 4 });
      expect(finale.enemies[finale.enemies.length - 1]?.kind).toBe('chieftain');
      expect(finale.enemies.filter(enemy => enemy.kind === 'thrower').length).toBeGreaterThan(0);
      expect(finale.enemies.filter(enemy => enemy.kind === 'thrower').length).toBeLessThanOrEqual(2);
    }
  });
});

describe('tower durability', () => {
  it('builds each tower at its full distinct health and adds health per level', () => {
    expect(towerMaxHealth('archer', 1)).toBe(180);
    expect(towerMaxHealth('cannon', 1)).toBe(220);
    expect(towerMaxHealth('frost', 3)).toBe(330);
    const tower = buildTower(createGame(), 1, 'archer').towers[0];
    expect(tower).toMatchObject({ hp: 180, maxHp: 180 });
  });

  it('preserves missing health when upgrading a damaged tower without mutating it', () => {
    const state = combat();
    const damaged = freeze({ ...state, towers: [{ ...state.towers[0], hp: 150 }] });
    const upgraded = upgradeTower(damaged, damaged.towers[0].id);
    expect(upgraded.towers[0]).toMatchObject({ level: 2, hp: 230, maxHp: 260 });
    expect(damaged.towers[0].hp).toBe(150);
  });

  it('charges for the missing proportion of health and restores it once', () => {
    const state = combat();
    const damaged = freeze({ ...state, towers: [{ ...state.towers[0], hp: 90 }] });
    const cost = repairCost(damaged.towers[0]);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThanOrEqual(Math.ceil(70 * .25));
    const repaired = repairTower(damaged, damaged.towers[0].id);
    expect(repaired.towers[0]).toMatchObject({ hp: 180, maxHp: 180 });
    expect(repaired.diamonds).toBe(damaged.diamonds - cost);
    expect(repairTower(repaired, repaired.towers[0].id)).toBe(repaired);
    expect(repairCost(repaired.towers[0])).toBe(0);
  });

  it('rejects unavailable, unaffordable, and terminal repairs without spending', () => {
    const state = combat();
    const damaged = { ...state, towers: [{ ...state.towers[0], hp: 20 }] };
    expect(repairTower(damaged, 'missing')).toBe(damaged);
    for (const phase of ['defeat', 'victory'] as const) {
      const terminal = { ...damaged, phase };
      expect(repairTower(terminal, damaged.towers[0].id)).toBe(terminal);
    }
    const poor = { ...damaged, diamonds: 0 };
    expect(repairTower(poor, poor.towers[0].id)).toBe(poor);
  });
});

describe('ranged tower combat', () => {
  it('damages a nearby tower, emits a visible axe and damage event, and keeps the input immutable', () => {
    const state = freeze(combat());
    const result = tickGame(state, .1);
    expect(result.towers[0].hp).toBe(172);
    expect(result.shots).toContainEqual(expect.objectContaining({ type: 'axe' }));
    expect(result.damageEvents).toContainEqual(expect.objectContaining({ target: 'tower', targetId: 'tower-1', amount: 8, destroyed: false }));
    expect(state.towers[0].hp).toBe(180);
    expect(state.enemies[0].rangedCooldown).toBeUndefined();
  });

  it('chooses the nearest tower rather than the first tower in the array', () => {
    const state = buildTower(combat(), 2, 'cannon');
    const ready = { ...state, towers: state.towers.map(tower => ({ ...tower, cooldown: 100 })),
      enemies: [{ ...state.enemies[0], distance: 220 }] };
    const result = tickGame(ready, .1);
    expect(result.towers.find(tower => tower.slotId === 1)?.hp).toBe(180);
    expect(result.towers.find(tower => tower.slotId === 2)?.hp).toBe(212);
  });

  it('respects its cooldown and resumes firing after two seconds', () => {
    let result = tickGame(combat(), .1);
    for (let i = 0; i < 19; i += 1) result = tickGame(result, .1);
    expect(result.towers[0].hp).toBe(172);
    result = tickGame(result, .1);
    expect(result.towers[0].hp).toBe(164);
  });

  it.each([
    { distance: -1 }, { distance: 0 }, { distance: pathLengthForRegion(0) },
    { hp: 0 }, { kind: 'clubber' as const }, { kind: 'axeman' as const },
  ])('cannot throw from a hidden, escaped, dead, distant or non-ranged mob: %j', patch => {
    const state = combat();
    const result = tickGame({ ...state, enemies: [{ ...state.enemies[0], ...patch }] }, .1);
    expect(result.towers[0].hp).toBe(180);
    expect(result.shots.some(shot => shot.type === 'axe')).toBe(false);
  });

  it('does not let a thrower killed by the tower retaliate', () => {
    const state = combat();
    const result = tickGame({ ...state, towers: state.towers.map(tower => ({ ...tower, cooldown: 0 })),
      enemies: [{ ...state.enemies[0], hp: 1 }] }, .1);
    expect(result.towers[0].hp).toBe(180);
    expect(result.enemies).toHaveLength(0);
    expect(result.shots.some(shot => shot.type === 'axe')).toBe(false);
  });

  it('uses soldiers as a counter by suppressing throwing during melee engagement', () => {
    const state = deploySoldiers(combat(), 'tower-1');
    const result = tickGame({ ...state, soldiers: state.soldiers.map(soldier => ({ ...soldier, distance: state.enemies[0].distance, cooldown: 10 })) }, .1);
    expect(result.enemies[0].engaged).toBe(true);
    expect(result.towers[0].hp).toBe(180);
    expect(result.soldiers[0].hp).toBeLessThan(50);
  });

  it('continues walking and throwing while Deep Freeze slows movement', () => {
    const state = combat();
    const result = tickGame({ ...state, freezeTime: 2, enemies: [{ ...state.enemies[0], speed: 40 }] }, .1);
    expect(result.enemies[0].distance - state.enemies[0].distance).toBeCloseTo(.48);
    expect(result.towers[0].hp).toBe(172);
  });

  it('scales axe damage by region while keeping one attack per cooldown', () => {
    const result = tickGame(combat(4), .1);
    expect(result.towers[0].hp).toBe(164);
  });

  it('destroys the tower without refund, reopens its spot, and retains its deployed soldiers', () => {
    const deployed = deploySoldiers(combat(), 'tower-1');
    const state = { ...deployed, towers: [{ ...deployed.towers[0], hp: 1 }],
      soldiers: deployed.soldiers.map(soldier => ({ ...soldier, distance: 1000 })) };
    const result = tickGame(state, .1);
    expect(result.towers).toHaveLength(0);
    expect(result.diamonds).toBe(state.diamonds);
    expect(result.damageEvents[result.damageEvents.length - 1]).toMatchObject({ amount: 1, destroyed: true, target: 'tower' });
    expect(result.soldiers).toHaveLength(2);
    const rebuilt = buildTower(result, 1, 'archer');
    expect(rebuilt.towers).toHaveLength(1);
    expect(deploySoldiers(rebuilt, 'tower-1')).toBe(rebuilt);
  });

  it('retargets after destruction and never hits a removed tower again', () => {
    const state = buildTower(combat(), 2, 'archer');
    const result = tickGame({ ...state, towers: state.towers.map(tower => ({ ...tower, hp: tower.slotId === 2 ? 1 : tower.hp, cooldown: 100 })),
      enemies: [{ ...state.enemies[0], distance: 220 }, { ...state.enemies[0], id: 901, distance: 220 }] }, .1);
    expect(result.towers).toHaveLength(1);
    expect(result.towers[0]).toMatchObject({ slotId: 1, hp: 172 });
  });

  it('expires hit feedback after a wave and removes axe effects on subsequent ticks', () => {
    const hit = tickGame(combat(), .1);
    let result: GameState = { ...hit, phase: 'reward' };
    for (let i = 0; i < 40; i += 1) result = tickGame(result, .1);
    expect(result.damageEvents).toHaveLength(0);
    let active: GameState = { ...hit, enemies: [{ ...hit.enemies[0], rangedCooldown: 10 }] };
    for (let i = 0; i < 10; i += 1) active = tickGame(active, .1);
    expect(active.shots).toHaveLength(0);
  });
});

describe('castle damage feedback', () => {
  it('records the actual health lost when a chieftain escapes, including lethal hits', () => {
    const state = combat();
    const captain: Enemy = { ...state.enemies[0], kind: 'chieftain', distance: pathLengthForRegion(0), hp: 100 };
    const result = tickGame({ ...state, lives: 2, enemies: [captain] }, .1);
    expect(result.lives).toBe(0);
    expect(result.phase).toBe('defeat');
    expect(result.damageEvents).toContainEqual(expect.objectContaining({ target: 'castle', amount: 2, destroyed: true }));
  });
});
