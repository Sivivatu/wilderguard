import { SOLDIERS } from './soldiers';
import { createGame, getWaveReward, MAX_TOWER_LEVEL, REGIONS, SLOTS, type GameState, type Spell, type TowerType } from './game';
const SAVE_KEY = 'wilderguard-campaign-v1';
const isInteger = (value: unknown, max: number): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export function encodeSave(state: GameState): string | null {
  if (state.phase === 'wave' || state.phase === 'defeat') return null;
  return JSON.stringify({ version: 1, regionIndex: state.regionIndex, diamonds: state.diamonds,
    lives: state.lives, wave: state.wave, towers: state.towers, inventory: state.inventory, kills: state.kills, soldierTrainingLevel: state.soldierTrainingLevel });
}
export function decodeSave(raw: string | null): GameState | null {
  if (!raw || raw.length > 16384) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || !isInteger(data.regionIndex, REGIONS.length - 1) || !isInteger(data.diamonds, 1000000)
      || !isInteger(data.lives, 20) || data.lives === 0 || !isInteger(data.wave, 5) || !isInteger(data.kills, 1000000)) return null;
    const training = data.soldierTrainingLevel === undefined ? 1 : data.soldierTrainingLevel;
    if (!isInteger(training, SOLDIERS.maxLevel) || training === 0) return null;
    if (!isRecord(data.inventory) || !['meteor', 'freeze', 'heal'].every(spell => isInteger((data.inventory as Record<string, unknown>)[spell], 1000))) return null;
    if (!Array.isArray(data.towers) || data.towers.length > SLOTS.length) return null;
    const seen = new Set<number>();
    const valid = data.towers.every((tower: unknown) => {
      if (!isRecord(tower) || !isInteger(tower.slotId, SLOTS.length) || tower.slotId === 0 || seen.has(tower.slotId)
        || tower.id !== `tower-${tower.slotId}` || !['archer', 'cannon', 'frost'].includes(String(tower.type))
        || !isInteger(tower.level, MAX_TOWER_LEVEL) || tower.level === 0) return false;
      seen.add(tower.slotId); return true;
    });
    if (!valid) return null;
    return { ...createGame(data.regionIndex, data.diamonds), lives: data.lives, wave: data.wave, soldierTrainingLevel: training,
      phase: data.wave === 5 ? 'victory' : data.wave === 0 ? 'preparing' : 'reward', kills: data.kills,
      reward: data.wave > 0 ? getWaveReward(data.regionIndex, data.wave) : null,
      inventory: { meteor: data.inventory.meteor as number, freeze: data.inventory.freeze as number, heal: data.inventory.heal as number },
      towers: data.towers.map(tower => ({ id: tower.id as string, slotId: tower.slotId as number, type: tower.type as TowerType, level: tower.level as number, cooldown: 0 })) };
  } catch { return null; }
}
export function loadGame(): GameState | null {
  try { return decodeSave(localStorage.getItem(SAVE_KEY)); }
  catch (error) { console.warn('Campaign storage is unavailable.', error); return null; }
}
export function saveGame(state: GameState): boolean {
  const encoded = encodeSave(state);
  if (!encoded) return true;
  try { localStorage.setItem(SAVE_KEY, encoded); return true; }
  catch (error) { console.warn('Campaign could not be saved.', error); return false; }
}
export const SPELL_NAMES: Record<Spell, string> = { meteor: 'Starfall', freeze: 'Deep freeze', heal: 'Mending light' };
