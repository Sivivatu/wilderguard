import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceRegion, buildTower, createGame, REGIONS, repairTower, startWave, tickGame, upgradeTower, useSpell, type TowerType } from '../src/game';

afterEach(() => vi.restoreAllMocks());

describe('full country campaign with earned resources', () => {
  it.each([1, 7, 42])('can liberate all five regions without free diamonds with chill seed %i', seed => {
    let randomState = seed;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296;
    });
    let state = createGame();
    const history: string[] = [];
    const plan: Array<{ slot: number; type: TowerType }> = [
      { slot: 2, type: 'archer' }, { slot: 1, type: 'cannon' }, { slot: 8, type: 'frost' },
      { slot: 4, type: 'archer' }, { slot: 6, type: 'cannon' }, { slot: 5, type: 'frost' },
      { slot: 7, type: 'archer' }, { slot: 3, type: 'cannon' },
    ];

    for (const region of REGIONS) {
      for (let wave = 1; wave <= 5; wave += 1) {
        // Repair persistent siege damage using earned diamonds before building further.
        for (const tower of state.towers) state = repairTower(state, tower.id);
        // In the two hardest regions, improve the four-tower choke point before spreading funds thin.
        const regionalPlan = state.regionIndex >= REGIONS.length - 2 ? plan.slice(0, 4) : plan;
        for (const placement of regionalPlan) {
          const next = buildTower(state, placement.slot, placement.type);
          if (next !== state) state = next;
        }
        // Use earned savings to improve a tower once the new line is built.
        for (const tower of [...state.towers].sort((a, b) => a.level - b.level)) {
          if (tower.level < 3 && state.diamonds >= 49) {
            const upgraded = upgradeTower(state, tower.id);
            if (upgraded !== state) state = upgraded;
          }
        }

        state = startWave(state);
        if (state.phase !== 'wave') break;
        let elapsed = 0;
        while (state.phase === 'wave' && elapsed < 500) {
          state = tickGame(state, .1);
          elapsed += .1;
          // React to siege hits before a damaged defense is destroyed.
          for (const tower of state.towers) {
            if (tower.hp < tower.maxHp * .5) state = repairTower(state, tower.id);
          }
          if (elapsed >= .5) {
            if (state.lives <= 14 && state.inventory.heal > 0) state = useSpell(state, 'heal');
            const visibleEnemies = state.enemies.filter(enemy => enemy.distance >= 0).length;
            // Wait for a visible group so spells do not get wasted on waiting spawns.
            if (state.inventory.meteor > 0 && visibleEnemies >= 5) state = useSpell(state, 'meteor');
            if (state.inventory.freeze > 0 && wave >= 4 && visibleEnemies >= 5) state = useSpell(state, 'freeze');
          }
        }
        history.push(`${region.name} wave ${wave}: ${state.phase}, ${state.lives} health, ${state.diamonds} diamonds, ${state.kills} kills (${elapsed.toFixed(1)}s)`);
        if (state.phase === 'defeat') break;
      }
      if (state.phase !== 'victory') break;
      if (region !== REGIONS[REGIONS.length - 1]) state = advanceRegion(state);
    }

    expect(state.phase, history.join('\n')).toBe('victory');
    expect(state.kills).toBeGreaterThan(40);
    expect(history.filter(entry => entry.includes('wave 5: victory'))).toHaveLength(REGIONS.length);
    expect(state.regionIndex).toBe(REGIONS.length - 1);
    expect(state.lives).toBeGreaterThan(0);
  });
});
