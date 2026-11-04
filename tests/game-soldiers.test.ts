import { describe, expect, it } from 'vitest';
import { advanceRegion, buildTower, createGame, startWave, tickGame, type GameState } from '../src/game';
import { pathLengthForRegion, nearestRegionDistance } from '../src/region-geometry';
import { deploySoldiers, SOLDIERS, trainSoldiers, type SoldierGameState } from '../src/soldiers';

const soldierState = (state: GameState): SoldierGameState => state as SoldierGameState;

describe('soldier campaign integration', () => {
  it('starts with an empty garrison and carries campaign training to the next region', () => {
    const initial = createGame();
    expect(soldierState(initial)).toMatchObject({ soldierTrainingLevel: 1, soldiers: [], deployments: [] });

    const trained = trainSoldiers(soldierState({ ...initial, diamonds: 100 }));
    const victory = { ...trained, phase: 'victory' as const, wave: 5 };
    expect(soldierState(advanceRegion(victory))).toMatchObject({ regionIndex: 1, soldierTrainingLevel: 2, soldiers: [], deployments: [] });
  });

  it('lets deployed soldiers kill through the shared wave resolver and trigger Frost Nova', () => {
    const towered = buildTower(createGame(0, 500), 1, 'frost');
    const wave = startWave(towered);
    const base = soldierState(wave);
    const squad = deploySoldiers(base, 'tower-1');
    const origin = base.enemies[0];
    const nearby = { ...origin, id: origin.id + 1, distance: 258, hp: 50, maxHp: 50, frostNovaTime: 0 };
    const marked = { ...origin, distance: 250, hp: 1, maxHp: 50, frostNovaTime: 2 };
    const combat: SoldierGameState = { ...squad, soldiers: squad.soldiers.map(soldier => ({ ...soldier, distance: 250 })), enemies: [marked, nearby] };

    const result = soldierState(tickGame(combat, 0.1));
    expect(result.kills).toBe(1);
    expect(result.enemies.some(enemy => enemy.id === marked.id)).toBe(false);
    expect(result.frostBursts.length).toBeGreaterThan(0);
    expect(result.enemies.find(enemy => enemy.id === nearby.id)?.slow).toBeGreaterThan(0);
  });

  it('blocks a mob from advancing while soldiers engage it', () => {
    const wave = soldierState(startWave(buildTower(createGame(), 1, 'archer')));
    const target = wave.enemies[0];
    const engaged: SoldierGameState = {
      ...wave,
      soldiers: [{ id: 'test-soldier', deploymentId: 'test-squad', towerId: 'tower-1', distance: 100, hp: 50, maxHp: 50, level: 1, cooldown: 1 }],
      enemies: [{ ...target, distance: 100 }],
    };

    const next = soldierState(tickGame(engaged, 0.1));
    expect(next.enemies[0].distance).toBe(100);
    expect(next.enemies[0].engaged).toBe(true);
  });

  it.each([[1, 15], [2, 30]] as const)('returns %i living soldiers’ share of the deployment cost', (survivors, refund) => {
    const wave = soldierState(startWave(buildTower(createGame(0, 500), 1, 'archer')));
    const deployed = deploySoldiers(wave, 'tower-1');
    const live = deployed.soldiers.map((soldier, index) => ({ ...soldier, hp: index < survivors ? 10 : 0 }));
    const completed: SoldierGameState = { ...deployed, phase: 'wave', enemies: [], soldiers: live };
    const result = soldierState(tickGame(completed, 0.1));

    expect(result.phase).toBe('reward');
    expect(result.reward?.soldierRefund).toBe(refund);
    expect(result.diamonds).toBe(completed.diamonds + result.reward!.diamonds + refund);
    expect(result.soldiers).toEqual([]);
    expect(result.deployments).toEqual([]);
    expect(tickGame(result, 0.1)).toBe(result);
  });

  it('removes a defeated squad without refund when the village falls', () => {
    const wave = soldierState(startWave(buildTower(createGame(0, 500), 1, 'archer')));
    const deployed = deploySoldiers(wave, 'tower-1');
    const length = pathLengthForRegion(0);
    const state: SoldierGameState = {
      ...deployed,
      lives: 1,
      soldiers: deployed.soldiers.map(soldier => ({ ...soldier, hp: 0 })),
      enemies: [{ ...wave.enemies[0], distance: length - 1, speed: 40 }],
    };
    const result = soldierState(tickGame(state, 0.1));

    expect(result.phase).toBe('defeat');
    expect(result.soldiers).toEqual([]);
    expect(result.deployments).toEqual([]);
    expect(result.diamonds).toBe(state.diamonds);
  });

  it('uses the region route for tower targeting and escape checks', () => {
    const regionIndex = 1;
    const towered = buildTower(createGame(regionIndex, 500), 3, 'archer');
    const wave = startWave(towered);
    const distance = nearestRegionDistance(regionIndex, 365, 425);
    const target = { ...wave.enemies[0], distance, hp: 100, maxHp: 100 };
    const positioned: GameState = { ...wave, enemies: [target] };
    expect(tickGame(positioned, 0.1).enemies[0].hp).toBeLessThan(target.hp);

    const escape: GameState = { ...wave, lives: 1,
      enemies: [{ ...target, distance: pathLengthForRegion(0) + 5, speed: 10 }] };
    const afterMovement = tickGame(escape, 0.1);
    expect(afterMovement.phase).toBe('wave');
    expect(afterMovement.enemies).toHaveLength(1);
    expect(afterMovement.lives).toBe(1);
  });
});
