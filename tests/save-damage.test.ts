import { describe, expect, it } from 'vitest';
import { buildTower, createGame, type GameState } from '../src/game';
import { decodeSave, encodeSave } from '../src/save';

function savedTower(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ version: 1, regionIndex: 0, diamonds: 120, lives: 18, wave: 2, kills: 10,
    inventory: { meteor: 1, freeze: 2, heal: 1 },
    towers: [{ id: 'tower-1', slotId: 1, type: 'archer', level: 1, ...overrides }] });
}

describe('durability save compatibility', () => {
  it('restores old beta towers at full computed health', () => {
    expect(decodeSave(savedTower())?.towers[0]).toMatchObject({ hp: 180, maxHp: 180 });
    expect(decodeSave(savedTower({ level: 3 }))?.towers[0]).toMatchObject({ hp: 340, maxHp: 340 });
  });

  it('keeps damaged tower health across a checkpoint and resets transient effects', () => {
    const built = buildTower(createGame(), 1, 'archer');
    const checkpoint: GameState = { ...built, wave: 2, phase: 'reward',
      towers: built.towers.map(tower => ({ ...tower, hp: 63, maxHp: 180 })),
      damageEvents: [{ target: 'tower', targetId: 'tower-1', position: { x: 305, y: 275 }, amount: 8, destroyed: false, life: 1 }] };
    const restored = decodeSave(encodeSave(checkpoint));
    expect(restored?.towers[0]).toMatchObject({ hp: 63, maxHp: 180, cooldown: 0 });
    expect(restored?.damageEvents).toEqual([]);
    expect(restored?.shots).toEqual([]);
  });

  it.each([0, -1, 181, 1.5, '50', null])('rejects invalid remaining health %s', hp => {
    expect(decodeSave(savedTower({ hp, maxHp: 180 }))).toBeNull();
  });

  it.each([0, 179, 181, '180', null])('rejects a forged maximum health %s', maxHp => {
    expect(decodeSave(savedTower({ hp: 50, maxHp }))).toBeNull();
  });

  it('rejects incomplete durability instead of granting free healing', () => {
    expect(decodeSave(savedTower({ maxHp: 180 }))).toBeNull();
    expect(decodeSave(savedTower({ hp: 50 }))).toBeNull();
  });
});
