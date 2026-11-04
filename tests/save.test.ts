import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTower, createGame, startWave, type GameState } from '../src/game';
import { decodeSave, encodeSave, loadGame, saveGame } from '../src/save';

function snapshot(overrides: Record<string, unknown> = {}) {
  const base = JSON.parse(encodeSave(createGame())!) as Record<string, unknown>;
  return { ...base, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('campaign saves', () => {
  it('encodes and decodes a valid campaign including towers and inventory', () => {
    let game = createGame(1, 438);
    game = buildTower(game, 4, 'cannon');
    game = { ...game, lives: 13, wave: 2, phase: 'reward', kills: 16,
      inventory: { meteor: 2, freeze: 0, heal: 1 } };

    const encoded = encodeSave(game);
    const decoded = decodeSave(encoded);
    expect(decoded).toMatchObject({ regionIndex: 1, diamonds: 338, lives: 13, wave: 2, phase: 'reward', kills: 16,
      inventory: { meteor: 2, freeze: 0, heal: 1 } });
    expect(decoded?.towers).toEqual([{ ...game.towers[0], cooldown: 0 }]);
  });

  it('saves campaign soldier training and defaults older saves to level one', () => {
    const trained = { ...createGame(1, 438), soldierTrainingLevel: 3 } as GameState;
    const decoded = decodeSave(encodeSave(trained));
    expect(decoded).toMatchObject({ regionIndex: 1, soldierTrainingLevel: 3 });

    const legacy = snapshot();
    delete legacy.soldierTrainingLevel;
    expect(decodeSave(JSON.stringify(legacy))).toMatchObject({ soldierTrainingLevel: 1 });
  });

  it.each([null, '', '{broken json', 'null', '[]', '42'])('returns null for missing or malformed input %s', raw => {
    expect(decodeSave(raw)).toBeNull();
  });

  it.each([
    ['version', { version: 2 }],
    ['region lower bound', { regionIndex: -1 }],
    ['region upper bound', { regionIndex: 5 }],
    ['fractional diamonds', { diamonds: 1.5 }],
    ['excessive diamonds', { diamonds: 1_000_001 }],
    ['zero lives', { lives: 0 }],
    ['excessive lives', { lives: 21 }],
    ['negative wave', { wave: -1 }],
    ['excessive wave', { wave: 6 }],
    ['soldier training below level one', { soldierTrainingLevel: 0 }],
    ['soldier training above level three', { soldierTrainingLevel: 4 }],
    ['fractional soldier training', { soldierTrainingLevel: 1.5 }],
    ['null soldier training', { soldierTrainingLevel: null }],
    ['negative kills', { kills: -1 }],
    ['missing inventory', { inventory: null }],
    ['negative spell count', { inventory: { meteor: -1, freeze: 0, heal: 0 } }],
    ['non-integer spell count', { inventory: { meteor: 1, freeze: 0.5, heal: 0 } }],
    ['excessive spell count', { inventory: { meteor: 1001, freeze: 0, heal: 0 } }],
    ['non-array towers', { towers: {} }],
    ['tower slot zero', { towers: [{ id: 'tower-0', slotId: 0, type: 'archer', level: 1 }] }],
    ['tower slot outside map', { towers: [{ id: 'tower-9', slotId: 9, type: 'archer', level: 1 }] }],
    ['duplicate tower slots', { towers: [
      { id: 'tower-1', slotId: 1, type: 'archer', level: 1 },
      { id: 'tower-1', slotId: 1, type: 'frost', level: 2 },
    ] }],
    ['mismatched tower id', { towers: [{ id: 'other', slotId: 1, type: 'archer', level: 1 }] }],
    ['unknown tower type', { towers: [{ id: 'tower-1', slotId: 1, type: 'wizard', level: 1 }] }],
    ['tower level zero', { towers: [{ id: 'tower-1', slotId: 1, type: 'archer', level: 0 }] }],
    ['tower level over cap', { towers: [{ id: 'tower-1', slotId: 1, type: 'archer', level: 4 }] }],
  ])('rejects invalid save: %s', (_name, changes) => {
    expect(decodeSave(JSON.stringify(snapshot(changes as Record<string, unknown>)))).toBeNull();
  });

  it('rejects saves with more towers than the available map slots', () => {
    const towers = Array.from({ length: 9 }, (_, index) => ({ id: `tower-${index + 1}`, slotId: index + 1, type: 'archer', level: 1 }));
    expect(decodeSave(JSON.stringify(snapshot({ towers })))).toBeNull();
  });

  it('does not serialize or write active waves and defeated runs', () => {
    const preparing = createGame();
    const activeWave = startWave(preparing);
    const defeat: GameState = { ...activeWave, phase: 'defeat', lives: 0 };
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, getItem: vi.fn(() => null) });

    expect(encodeSave(activeWave)).toBeNull();
    expect(encodeSave(defeat)).toBeNull();
    expect(saveGame(activeWave)).toBe(true);
    expect(saveGame(defeat)).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each([
    [0, 'preparing'], [1, 'reward'], [3, 'reward'], [5, 'victory'],
  ] as const)('infers phase %s from the saved wave count', (wave, phase) => {
    const decoded = decodeSave(JSON.stringify(snapshot({ wave })));
    expect(decoded?.phase).toBe(phase);
  });

  it('loads and saves through local storage', () => {
    let stored: string | null = null;
    const storage = {
      getItem: vi.fn(() => stored),
      setItem: vi.fn((_key: string, value: string) => { stored = value; }),
    };
    vi.stubGlobal('localStorage', storage);

    expect(loadGame()).toBeNull();
    expect(saveGame(createGame(2, 450))).toBe(true);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(loadGame()?.regionIndex).toBe(2);
    expect(loadGame()?.diamonds).toBe(450);
    expect(storage.getItem).toHaveBeenCalledTimes(3);
  });

  it('returns a fresh game when storage reads fail and false when writes fail', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage read denied'); },
      setItem: () => { throw new Error('storage write denied'); },
    });

    expect(loadGame()).toBeNull();
    expect(saveGame(createGame())).toBe(false);
    expect(warning).toHaveBeenCalledTimes(2);
  });
});

describe('restored reward receipts', () => {
  it('restores victory rewards for display without granting them again', () => {
    const state: GameState = { ...createGame(0, 350), phase: 'victory', wave: 5 };
    const restored = decodeSave(encodeSave(state));
    expect(restored?.reward).toEqual({ diamonds: 260, item: 'meteor' });
    expect(restored?.diamonds).toBe(350);
  });

  it('rejects oversized storage content before parsing', () => {
    expect(decodeSave(' '.repeat(16385))).toBeNull();
  });
});
