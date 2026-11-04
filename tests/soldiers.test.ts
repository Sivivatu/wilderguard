import { describe, expect, it } from 'vitest';
import { buildTower, createGame, startWave, type Enemy } from '../src/game';
import { BUILD_SLOTS, nearestRegionDistance, pathLengthForRegion } from '../src/region-geometry';
import { deploySoldiers, refundForDeployment, settleSoldiers, soldierStats, SOLDIERS, tickSoldiers, trainSoldiers, trainingCost, type SoldierGameState } from '../src/soldiers';

function army(wave = true): SoldierGameState {
  const state = buildTower(createGame(0, 1000), 1, 'archer');
  return { ...(wave ? startWave(state) : state), soldierTrainingLevel: 1, soldiers: [], deployments: [] };
}
const enemy = (distance: number, hp = 100): Enemy => ({ id: 1, distance, hp, maxHp: hp, speed: 40, kind: 'clubber', slow: 0 });

describe('soldier deployments', () => {
  it('charges 30 diamonds for two soldiers at the tower and permits one squad per tower per wave', () => {
    const before = army();
    const result = deploySoldiers(before, before.towers[0].id);
    expect(result.diamonds).toBe(before.diamonds - 30);
    expect(result.soldiers).toHaveLength(2);
    expect(result.deployments).toHaveLength(1);
    expect(result.soldiers.every(soldier => soldier.distance >= 0 && soldier.hp === 50)).toBe(true);
    expect(deploySoldiers(result, result.towers[0].id)).toBe(result);
    expect(before.soldiers).toEqual([]);
  });

  it('rejects missing towers, insufficient diamonds, non-wave phases and invalid training', () => {
    const state = army();
    expect(deploySoldiers(state, 'missing')).toBe(state);
    for (const phase of ['preparing', 'reward', 'victory', 'defeat'] as const) {
      const inactive = { ...state, phase };
      expect(deploySoldiers(inactive, state.towers[0].id)).toBe(inactive);
    }
    const poor = { ...state, diamonds: 29 };
    expect(deploySoldiers(poor, state.towers[0].id)).toBe(poor);
    const invalid = { ...state, soldierTrainingLevel: Number.NaN };
    expect(deploySoldiers(invalid, state.towers[0].id)).toBe(invalid);
  });

  it('upgrades campaign training separately and only changes future squads', () => {
    const state = deploySoldiers(army(), 'tower-1');
    const trained = trainSoldiers(state);
    expect(trained.soldierTrainingLevel).toBe(2);
    expect(trained.towers[0].level).toBe(1);
    expect(trained.diamonds).toBe(state.diamonds - 35);
    expect(trained.soldiers.map(soldier => soldier.level)).toEqual([1, 1]);
    expect(trainSoldiers(trained).soldierTrainingLevel).toBe(3);
    expect(trainingCost(2)).toBe(70);
    const maxed = trainSoldiers(trained);
    expect(trainSoldiers(maxed)).toBe(maxed);
    expect(soldierStats(3)).toEqual({ hp: 120, damage: 24, interval: .8 });
  });

  it('does not train after a loss, after victory, with invalid training, or without the cost', () => {
    const state = army(false);
    for (const modified of [{ ...state, phase: 'defeat' as const }, { ...state, phase: 'victory' as const }, { ...state, soldierTrainingLevel: 0 }, { ...state, diamonds: 34 }]) {
      expect(trainSoldiers(modified)).toBe(modified);
    }
  });

  it('deploys independently from each tower using the current training and regional path', () => {
    const base = army();
    const state = { ...base, ...buildTower(base, 2, 'archer'), regionIndex: 3 };
    const first = deploySoldiers(state, 'tower-1');
    const trained = trainSoldiers(first);
    const result = deploySoldiers(trained, 'tower-2');
    const slot = BUILD_SLOTS.find(candidate => candidate.id === 2)!;
    expect(result.soldiers.map(soldier => soldier.level)).toEqual([1, 1, 2, 2]);
    expect(result.soldiers[2].hp).toBe(80);
    expect(result.soldiers[2].distance).toBe(nearestRegionDistance(3, slot.x, slot.y));
    expect(new Set(result.soldiers.map(soldier => soldier.id)).size).toBe(4);
    const deadSquad = { ...first, soldiers: [] };
    expect(deploySoldiers(deadSquad, 'tower-1')).toBe(deadSquad);
    const missingPad = { ...state, towers: [{ ...state.towers[0], slotId: -1 }] };
    expect(deploySoldiers(missingPad, 'tower-1')).toBe(missingPad);
  });

  it('trains between waves and guards against non-finite currency', () => {
    for (const phase of ['preparing', 'reward', 'wave'] as const) {
      expect(trainSoldiers({ ...army(), phase }).soldierTrainingLevel).toBe(2);
    }
    const state = { ...army(), diamonds: Number.NaN };
    expect(trainSoldiers(state)).toBe(state);
    expect(deploySoldiers(state, 'tower-1')).toBe(state);
    expect(trainingCost(3)).toBe(0);
    expect(trainingCost(Number.NaN)).toBe(0);
    expect(soldierStats(Number.NaN)).toEqual(soldierStats(1));
  });
});

describe('soldier combat', () => {
  it('marches toward the entrance and does not alter input soldiers', () => {
    const state = deploySoldiers(army(), 'tower-1');
    const before = state.soldiers[0].distance;
    const result = tickSoldiers({ ...state, enemies: [] }, .1);
    expect(result.soldiers[0].distance).toBeCloseTo(before - 4.5);
    expect(state.soldiers[0].distance).toBe(before);
  });

  it('blocks a mob and applies two soldier hits but only one enemy counterattack', () => {
    const state = deploySoldiers(army(), 'tower-1');
    const soldiers = state.soldiers.map(soldier => ({ ...soldier, distance: 480 }));
    const result = tickSoldiers({ ...state, soldiers, enemies: [enemy(480)] }, .1);
    expect(result.enemies[0].hp).toBe(80);
    expect(result.enemies[0].engaged).toBe(true);
    expect(result.soldiers.reduce((total, soldier) => total + soldier.hp, 0)).toBe(92);
    expect(result.soldiers.every(soldier => soldier.distance === 480)).toBe(true);
    const cooling = tickSoldiers({ ...state, ...result }, .1);
    expect(cooling.enemies[0].hp).toBe(80);
    expect(cooling.soldiers.reduce((total, soldier) => total + soldier.hp, 0)).toBe(92);
    expect(soldiers[0].hp).toBe(50);
  });

  it('can kill mobs, lose troops, and releases engagement when no soldier remains', () => {
    const state = deploySoldiers(army(), 'tower-1');
    const soldiers = [{ ...state.soldiers[0], distance: 480 }];
    const killed = tickSoldiers({ ...state, soldiers, enemies: [enemy(480, 5)] }, .1);
    expect(killed.enemies[0].hp).toBeLessThanOrEqual(0);
    const lost = tickSoldiers({ ...state, soldiers: [{ ...soldiers[0], hp: 1, cooldown: 1 }], enemies: [enemy(480)] }, .1);
    expect(lost.soldiers).toEqual([]);
    expect(lost.enemies[0].engaged).toBe(false);
  });

  it('ignores dead and waiting mobs and clamps movement at the entrance', () => {
    const state = deploySoldiers(army(), 'tower-1');
    const result = tickSoldiers({ ...state, soldiers: [{ ...state.soldiers[0], distance: 1 }], enemies: [enemy(-1), { ...enemy(1), id: 2, hp: 0 }] }, .1);
    expect(result.soldiers[0].distance).toBe(0);
    expect(result.enemies.every(mob => !mob.engaged)).toBe(true);
    expect(result.soldiers[0].hp).toBe(50);
  });

  it('leaves combat untouched outside waves or for an invalid time step', () => {
    const state = deploySoldiers(army(), 'tower-1');
    for (const dt of [0, -1, Infinity, Number.NaN]) {
      const result = tickSoldiers(state, dt);
      expect(result.soldiers).toBe(state.soldiers);
      expect(result.enemies).toBe(state.enemies);
    }
    expect(tickSoldiers({ ...state, phase: 'reward' }, .1).soldiers).toBe(state.soldiers);
    expect(tickSoldiers({ ...state, enemies: [] }, 10).soldiers[0].distance)
      .toBeCloseTo(state.soldiers[0].distance - 4.5);
  });

  it.each([['axeman', 1.3], ['chieftain', 2]] as const)('scales %s melee strength by region', (kind, multiplier) => {
    const state = deploySoldiers(army(), 'tower-1');
    const soldiers = [{ ...state.soldiers[0], distance: 480, cooldown: 1 }];
    const result = tickSoldiers({ ...state, regionIndex: 2, soldiers, enemies: [{ ...enemy(480), kind }] }, .1);
    expect(result.soldiers[0].hp).toBeCloseTo(50 - 14 * multiplier);
  });

  it('clears stale engagement and ignores enemies beyond the exit', () => {
    const state = deploySoldiers(army(), 'tower-1');
    const length = pathLengthForRegion(state.regionIndex);
    const result = tickSoldiers({ ...state, soldiers: [{ ...state.soldiers[0], distance: length }],
      enemies: [{ ...enemy(length), engaged: true } as Enemy] }, .1);
    expect(result.enemies[0].engaged).toBe(false);
    expect(result.soldiers[0].hp).toBe(50);
    expect(tickSoldiers({ ...state, soldiers: [], enemies: [{ ...enemy(480), engaged: true } as Enemy] }, .1).enemies[0].engaged).toBe(false);
  });
});

describe('survivor refunds', () => {
  it.each([0, 1, 2])('refunds each survivor’s share exactly once after a wave with %i survivors', count => {
    const deployed = deploySoldiers(army(), 'tower-1');
    const refund = count * SOLDIERS.deployCost / SOLDIERS.squadSize;
    expect(refundForDeployment(deployed.deployments[0], count)).toBe(refund);
    const state = { ...deployed, phase: 'reward' as const, soldiers: deployed.soldiers.slice(0, count), reward: { diamonds: 48, item: null } };
    const result = settleSoldiers(state);
    expect(result.diamonds).toBe(state.diamonds + refund);
    expect(result.reward?.soldierRefund).toBe(refund);
    expect(result.soldiers).toEqual([]);
    expect(result.deployments).toEqual([]);
    expect(settleSoldiers(result)).toBe(result);
  });

  it('never refunds early or after defeat', () => {
    const state = deploySoldiers(army(), 'tower-1');
    expect(settleSoldiers(state)).toBe(state);
    const defeat = { ...state, phase: 'defeat' as const };
    expect(settleSoldiers(defeat)).toBe(defeat);
  });

  it('settles a final-wave win without refunding dead soldiers', () => {
    const base = army();
    const state = { ...base, ...buildTower(base, 2, 'archer') };
    const deployed = deploySoldiers(deploySoldiers(state, 'tower-1'), 'tower-2');
    const result = settleSoldiers({ ...deployed, phase: 'victory',
      soldiers: deployed.soldiers.map(soldier => ({ ...soldier, hp: soldier.towerId === 'tower-1' ? 0 : 1 })),
      reward: { diamonds: 100, item: null, soldierRefund: 5 } });
    expect(result.diamonds).toBe(deployed.diamonds + 30);
    expect(result.reward?.soldierRefund).toBe(35);
    expect(result.deployments).toEqual([]);
    const withoutReward = settleSoldiers({ ...deployed, phase: 'victory', reward: null });
    expect(withoutReward.diamonds).toBe(deployed.diamonds + 60);
    expect(withoutReward.reward).toBeNull();
  });

  it('rejects invalid refund counts and costs', () => {
    const deployment = { id: 'squad', towerId: 'tower-1', cost: 30 };
    for (const count of [-1, Number.NaN, Infinity, .5]) expect(refundForDeployment(deployment, count)).toBe(0);
    expect(refundForDeployment(deployment, SOLDIERS.squadSize + 1)).toBe(SOLDIERS.deployCost);
    for (const cost of [-30, 0, Number.NaN, Infinity]) expect(refundForDeployment({ ...deployment, cost }, 1)).toBe(0);
  });
});
