import { describe, expect, it } from 'vitest';
import {
  advanceRegion, buildTower, createGame, MAX_TOWER_LEVEL, REGIONS, sellTower, startWave,
  tickGame, TOWER_TYPES, upgradeTower, useSpell, type GameState,
} from '../src/game';

function finishWave(state: GameState) {
  let current = state;
  for (let step = 0; step < 5000 && current.phase === 'wave'; step += 1) current = tickGame(current, 0.1);
  return current;
}

function buildCampaignDefense(regionIndex = 0) {
  let state = createGame(regionIndex, 10_000);
  for (const placement of [
    [1, 'archer'], [4, 'cannon'], [6, 'frost'], [2, 'archer'],
    [8, 'frost'], [5, 'archer'], [7, 'cannon'], [3, 'archer'],
  ] as const) state = buildTower(state, placement[0], placement[1]);
  for (const tower of state.towers) {
    state = upgradeTower(state, tower.id);
    state = upgradeTower(state, tower.id);
  }
  return state;
}

function clearRegion(state: GameState) {
  let current = state;
  for (let waveNumber = 1; waveNumber <= 5; waveNumber += 1) {
    current = finishWave(startWave(current));
    if (waveNumber < 5 && current.phase === 'reward') current = startWave(current);
  }
  return current;
}

describe('tower defense campaign', () => {
  it('charges for a tower and leaves the original game state untouched', () => {
    const initial = createGame();
    const built = buildTower(initial, 1, 'archer');

    expect(built).not.toBe(initial);
    expect(built.diamonds).toBe(initial.diamonds - TOWER_TYPES.archer.cost);
    expect(built.towers).toHaveLength(1);
    expect(built.towers[0]).toMatchObject({ slotId: 1, type: 'archer', level: 1 });
    expect(initial.diamonds).toBe(120);
    expect(initial.towers).toHaveLength(0);
  });

  it('rejects invalid, occupied, and unaffordable tower placements', () => {
    const poor = createGame(0, 69);
    expect(buildTower(poor, 1, 'archer')).toBe(poor);
    expect(buildTower(createGame(), -1, 'archer')).toEqual(createGame());
    expect(buildTower(createGame(), 1, 'unknown' as 'archer')).toEqual(createGame());

    const built = buildTower(createGame(), 1, 'archer');
    expect(buildTower(built, 1, 'frost')).toBe(built);
  });

  it('upgrades a tower for 70% of base cost per level and caps upgrades at level three', () => {
    let state = buildTower(createGame(0, 1000), 1, 'archer');
    const id = state.towers[0].id;
    for (let level = 1; level < MAX_TOWER_LEVEL; level += 1) {
      const cost = Math.floor(TOWER_TYPES.archer.cost * 0.7 * level);
      const prior = state;
      state = upgradeTower(state, id);
      expect(state.diamonds).toBe(prior.diamonds - cost);
      expect(state.towers[0].level).toBe(level + 1);
    }
    expect(upgradeTower(state, id)).toBe(state);
    expect(upgradeTower(state, 'missing-tower')).toBe(state);
  });

  it('sells an upgraded tower for a 60% refund and rejects selling a missing tower', () => {
    let state = buildTower(createGame(0, 1000), 1, 'archer');
    const id = state.towers[0].id;
    state = upgradeTower(upgradeTower(state, id), id);
    const refund = Math.floor((70 + 49 + 98) * 0.6);
    const sold = sellTower(state, id);

    expect(sold.diamonds).toBe(state.diamonds + refund);
    expect(sold.towers).toHaveLength(0);
    expect(sellTower(sold, id)).toBe(sold);
  });

  it('clears a defended wave and grants its diamond reward once', () => {
    const prepared = buildTower(createGame(), 1, 'archer');
    const wave = startWave(prepared);
    expect(wave.phase).toBe('wave');
    expect(wave.enemies.length).toBeGreaterThan(0);

    const reward = finishWave(wave);
    expect(reward.phase).toBe('reward');
    expect(reward.enemies).toHaveLength(0);
    expect(reward.diamonds).toBeGreaterThan(prepared.diamonds);
    expect(reward.reward?.diamonds).toBeGreaterThanOrEqual(35);
    expect(tickGame(reward, 0.1)).toBe(reward);
  });

  it('defeats an undefended village and refuses to launch another wave', () => {
    let state = createGame();
    for (let wave = 0; wave < 10 && state.phase !== 'defeat'; wave += 1) {
      state = startWave(state);
      state = finishWave(state);
    }

    expect(state.phase).toBe('defeat');
    expect(state.lives).toBe(0);
    expect(startWave(state)).toBe(state);
  });

  it('awards special items on waves three and five', () => {
    const defense = buildCampaignDefense();
    let state = startWave(defense);
    state = finishWave(state);
    state = startWave(state);
    state = finishWave(state);
    expect(state.phase).toBe('reward');
    expect(state.wave).toBe(2);

    state = startWave(state);
    state = finishWave(state);
    expect(state.reward?.item).toBe('freeze');
    expect(state.inventory.freeze).toBe(3);
    state = startWave(state);
    state = finishWave(state);
    state = startWave(state);
    state = finishWave(state);
    expect(state.phase).toBe('victory');
    expect(state.reward?.item).toBe('meteor');
    expect(state.inventory.meteor).toBe(2);
  });

  it('only uses spells during combat and consumes each available charge once', () => {
    const prepared = buildTower(createGame(), 1, 'archer');
    expect(useSpell(prepared, 'meteor')).toBe(prepared);
    const wave = startWave(prepared);
    const afterSpell = useSpell(wave, 'meteor');

    expect(afterSpell).not.toBe(wave);
    expect(afterSpell.inventory.meteor).toBe(wave.inventory.meteor - 1);
    expect(useSpell(afterSpell, 'meteor')).toBe(afterSpell);
  });

  it('does not spend a healing spell when lives are already full', () => {
    const wave = startWave(buildTower(createGame(), 1, 'archer'));
    expect(useSpell(wave, 'heal')).toBe(wave);
  });

  it('freezes enemies briefly, then lets them move at normal speed after the effect expires', () => {
    const wave = startWave(createGame());
    const frozen = useSpell(wave, 'freeze');
    const firstEnemy = wave.enemies[0];
    const frozenDistance = frozen.enemies[0].distance;
    const duringFreeze = tickGame(frozen, 0.1);

    expect(frozen.freezeTime).toBe(6);
    expect(duringFreeze.enemies[0].distance - frozenDistance).toBeCloseTo(firstEnemy.speed * 0.1 * 0.12);
    let expired = duringFreeze;
    for (let step = 0; step < 60 && expired.phase === 'wave'; step += 1) expired = tickGame(expired, 0.1);
    expect(expired.freezeTime).toBe(0);
    if (expired.phase === 'wave') {
      const moving = tickGame(expired, 0.1);
      expect(moving.enemies[0].distance - expired.enemies[0].distance).toBeCloseTo(expired.enemies[0].speed * 0.1);
    }
  });

  it('slows a nearby enemy with frost and damages nearby enemies with cannon splash', () => {
    let frostWave = startWave(buildTower(createGame(0, 1000), 1, 'frost'));
    frostWave = { ...frostWave, enemies: frostWave.enemies.map(enemy => ({ ...enemy, distance: 480 })) };
    const frosted = tickGame(frostWave, 0.1);
    expect(frosted.enemies.some(enemy => enemy.slow > 0)).toBe(true);

    let cannonWave = startWave(buildTower(createGame(0, 1000), 1, 'cannon'));
    cannonWave = { ...cannonWave, enemies: cannonWave.enemies.map(enemy => ({ ...enemy, distance: 480 })) };
    const shelled = tickGame(cannonWave, 0.1);
    expect(shelled.enemies[0].hp).toBeLessThan(cannonWave.enemies[0].hp);
    expect(shelled.enemies[1].hp).toBeLessThan(cannonWave.enemies[1].hp);
  });

  it('only advances after the fifth wave, then resets towers and lives while preserving currency and items', () => {
    const defense = buildCampaignDefense();
    expect(advanceRegion(defense)).toBe(defense);
    const victory = clearRegion(defense);

    expect(victory.phase).toBe('victory');
    const nextRegion = advanceRegion(victory);
    expect(nextRegion.regionIndex).toBe(victory.regionIndex + 1);
    expect(nextRegion.wave).toBe(0);
    expect(nextRegion.phase).toBe('preparing');
    expect(nextRegion.towers).toHaveLength(0);
    expect(nextRegion.lives).toBe(20);
    expect(nextRegion.diamonds).toBe(victory.diamonds);
    expect(nextRegion.inventory).toEqual(victory.inventory);
  });

  it('allows the final region to be completed but not advanced beyond the campaign', () => {
    const victory = clearRegion(buildCampaignDefense(REGIONS.length - 1));
    expect(victory.phase).toBe('victory');
    expect(advanceRegion(victory)).toBe(victory);
  });
});
