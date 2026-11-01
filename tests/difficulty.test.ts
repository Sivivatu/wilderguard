import { describe, expect, it } from 'vitest';
import { buildTower, createGame, PATH_LENGTH, REGIONS, startWave, tickGame } from '../src/game';

function beginWave(regionIndex: number, waveNumber: number) {
  return startWave({ ...createGame(regionIndex), wave: waveNumber - 1, phase: waveNumber === 1 ? 'preparing' : 'reward' });
}

describe('orc wave difficulty', () => {
  it('scales ordinary orc health up at every wave and carries pressure into the next region', () => {
    const waveOne = beginWave(0, 1).enemies[0].maxHp;
    expect(waveOne).toBeGreaterThanOrEqual(45);
    expect(waveOne).toBeLessThanOrEqual(60);

    const sequence = REGIONS.flatMap((_, regionIndex) =>
      Array.from({ length: 5 }, (_, index) => beginWave(regionIndex, index + 1).enemies
        .filter(enemy => enemy.kind === 'clubber')
        .reduce((sum, enemy) => sum + enemy.maxHp, 0) /
        beginWave(regionIndex, index + 1).enemies.filter(enemy => enemy.kind === 'clubber').length));
    for (let index = 1; index < sequence.length; index += 1) {
      expect(sequence[index], `wave stage ${index + 1} should be tougher than stage ${index}`).toBeGreaterThan(sequence[index - 1]);
    }
  });

  it('introduces axe orcs after the opening and a much tougher three-life captain on each finale', () => {
    const opening = beginWave(0, 1).enemies;
    expect(opening.every(enemy => enemy.kind === 'clubber')).toBe(true);

    const waveThree = beginWave(0, 3).enemies;
    const axeman = waveThree.find(enemy => enemy.kind === 'axeman');
    const clubber = waveThree.find(enemy => enemy.kind === 'clubber');
    expect(axeman).toBeDefined();
    expect(clubber).toBeDefined();
    expect(axeman!.maxHp).toBeGreaterThan(clubber!.maxHp);

    const finale = beginWave(0, 5).enemies;
    const captain = finale[finale.length - 1];
    expect(captain.kind).toBe('chieftain');
    expect(captain.maxHp).toBeGreaterThan((axeman?.maxHp ?? 0) * 2);
    expect(REGIONS.every(region => /orc/i.test(region.monster))).toBe(true);
  });
});


describe('chieftain escapes', () => {
  it('cost three lives when the armored wave captain reaches the castle', () => {
    const finale = beginWave(0, 5);
    const captain = finale.enemies[finale.enemies.length - 1];
    const wave = {
      ...finale,
      enemies: finale.enemies.map(enemy => enemy.id === captain.id
        ? { ...enemy, distance: PATH_LENGTH - .1 }
        : { ...enemy, hp: -1 }),
    };

    const result = tickGame(wave, .1);

    expect(result.lives).toBe(17);
    expect(result.phase).toBe('victory');
  });
});


describe('late campaign pressure', () => {
  it('lets one starting archer hold the first wave but leak lives against the final wave', () => {
    const defendWithOneArcher = (regionIndex: number, waveNumber: number) => {
      const state = buildTower(createGame(regionIndex), 2, 'archer');
      let current = startWave({
        ...state,
        wave: waveNumber - 1,
        phase: waveNumber === 1 ? 'preparing' : 'reward',
      });
      for (let step = 0; step < 5000 && current.phase === 'wave'; step += 1) {
        current = tickGame(current, .1);
      }
      return current;
    };

    const opening = defendWithOneArcher(0, 1);
    const finale = defendWithOneArcher(REGIONS.length - 1, 5);

    expect(opening.lives).toBe(20);
    expect(finale.phase).toBe('victory');
    expect(finale.lives).toBeGreaterThan(0);
    expect(finale.lives).toBeLessThan(opening.lives);
  });
});
