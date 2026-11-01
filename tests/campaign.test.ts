import { describe, expect, it } from 'vitest';
import { advanceRegion, buildTower, createGame, REGIONS, startWave, tickGame, upgradeTower, useSpell, type TowerType } from '../src/game';

describe('full country campaign with earned resources', () => {
  it('can liberate all five regions without free diamonds', () => {
    let state = createGame();
    const history: string[] = [];
    const plan: Array<{ slot: number; type: TowerType }> = [
      { slot: 2, type: 'archer' }, { slot: 1, type: 'cannon' }, { slot: 8, type: 'frost' },
      { slot: 4, type: 'archer' }, { slot: 6, type: 'cannon' }, { slot: 5, type: 'frost' },
      { slot: 7, type: 'archer' }, { slot: 3, type: 'cannon' },
    ];

    for (const region of REGIONS) {
      for (let wave = 1; wave <= 5; wave += 1) {
        // Place affordable towers from the early choke point toward the castle.
        for (const placement of plan) {
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
          if (elapsed >= .5) {
            if (state.lives <= 14 && state.inventory.heal > 0) state = useSpell(state, 'heal');
            if (state.inventory.meteor > 0 && state.enemies.length >= 4) state = useSpell(state, 'meteor');
            if (state.inventory.freeze > 0 && wave >= 4 && state.enemies.length >= 5) state = useSpell(state, 'freeze');
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
