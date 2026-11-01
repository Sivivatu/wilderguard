export type TowerType = 'archer' | 'cannon' | 'frost';
export type Spell = 'meteor' | 'freeze' | 'heal';
export type Phase = 'preparing' | 'wave' | 'reward' | 'defeat' | 'victory';
export interface Point { x: number; y: number }
export interface Tower { id: string; slotId: number; type: TowerType; level: number; cooldown: number }
export interface Enemy { id: number; distance: number; hp: number; maxHp: number; speed: number; kind: 'clubber' | 'axeman' | 'chieftain'; slow: number }
export interface Shot { from: Point; to: Point; type: TowerType; life: number }
export interface GameState {
  regionIndex: number; diamonds: number; lives: number; wave: number; phase: Phase;
  towers: Tower[]; enemies: Enemy[]; shots: Shot[]; inventory: Record<Spell, number>;
  reward: { diamonds: number; item: Spell | null } | null;
  elapsed: number; freezeTime: number; kills: number;
}
export const WAVES_PER_REGION = 5;
export const MAX_TOWER_LEVEL = 3;
export const EFFECTS = { frostSpeed: .5, frostSeconds: 2, freezeSpeed: .12, freezeSeconds: 6, healHealth: 6, maxHealth: 20, splashDistance: 65 } as const;
export const REGIONS = [
  { name: 'The Greenfields', subtitle: 'Where your story begins', biome: 'Meadow', color: '#89ad65', monster: 'Greenfield club orcs', difficulty: 'Gentle beginnings' },
  { name: 'Whispering Woods', subtitle: 'Something stirs in the trees', biome: 'Forest', color: '#52836a', monster: 'Whispering Woods axe orcs', difficulty: 'Growing danger' },
  { name: 'Sunstone Ridge', subtitle: 'Hold the high ground', biome: 'Highlands', color: '#bc965a', monster: 'Sunstone bruiser orcs', difficulty: 'A tougher climb' },
  { name: 'Frostfall Pass', subtitle: 'A light against the cold', biome: 'Tundra', color: '#85a9b0', monster: 'Frostfall ice orcs', difficulty: 'Bitter resistance' },
  { name: 'The Hollow Crown', subtitle: 'Bring the kingdom home', biome: 'Ruins', color: '#8d7f9e', monster: 'The Hollow Crown orcs', difficulty: 'The last stand' },
] as const;
export const TOWER_TYPES: Record<TowerType, { name: string; cost: number; damage: number; range: number; interval: number; description: string; color: string }> = {
  archer: { name: 'Archer tower', cost: 70, damage: 15, range: 185, interval: .7, description: 'Quick shots. Steady aim.', color: '#57875c' },
  cannon: { name: 'Cannon tower', cost: 100, damage: 35, range: 170, interval: 1.65, description: 'A little more firepower.', color: '#a17c50' },
  frost: { name: 'Frost tower', cost: 85, damage: 8, range: 165, interval: .8, description: 'Slow every target you hit.', color: '#6f9fa3' },
};
export function towerStats(type: TowerType, level: number) {
  const base = TOWER_TYPES[type];
  return { damage: base.damage * (1 + (level - 1) * .7), range: base.range + (level - 1) * 15, interval: base.interval / (1 + (level - 1) * .15) };
}
export function meteorDamage(regionIndex: number) { return 110 * (1 + regionIndex * .25); }
export const SLOTS = [
  { id: 1, x: 305, y: 275 }, { id: 2, x: 165, y: 205 }, { id: 3, x: 365, y: 425 },
  { id: 4, x: 550, y: 285 }, { id: 5, x: 725, y: 335 }, { id: 6, x: 870, y: 330 },
  { id: 7, x: 920, y: 500 }, { id: 8, x: 485, y: 165 },
];
export const PATH: Point[] = [
  { x: -45, y: 310 }, { x: 175, y: 310 }, { x: 245, y: 250 }, { x: 245, y: 170 },
  { x: 355, y: 170 }, { x: 420, y: 230 }, { x: 420, y: 355 }, { x: 525, y: 390 },
  { x: 620, y: 350 }, { x: 650, y: 235 }, { x: 755, y: 210 }, { x: 805, y: 285 },
  { x: 790, y: 410 }, { x: 895, y: 445 }, { x: 1060, y: 415 },
];
const SEGMENTS = PATH.slice(1).map((point, index) => Math.hypot(point.x - PATH[index].x, point.y - PATH[index].y));
export const PATH_LENGTH = SEGMENTS.reduce((sum, length) => sum + length, 0);
export function pointOnPath(distance: number): Point {
  let remaining = Math.max(0, distance);
  for (let index = 0; index < SEGMENTS.length; index += 1) {
    if (remaining <= SEGMENTS[index]) {
      const fraction = remaining / SEGMENTS[index];
      return { x: PATH[index].x + (PATH[index + 1].x - PATH[index].x) * fraction, y: PATH[index].y + (PATH[index + 1].y - PATH[index].y) * fraction };
    }
    remaining -= SEGMENTS[index];
  }
  return { ...PATH[PATH.length - 1] };
}
export function createGame(regionIndex = 0, diamonds = 120): GameState {
  return {
    regionIndex: Math.min(REGIONS.length - 1, Math.max(0, Math.floor(regionIndex) || 0)),
    diamonds: Number.isFinite(diamonds) ? Math.max(0, Math.floor(diamonds)) : 120,
    lives: 20, wave: 0, phase: 'preparing', towers: [], enemies: [], shots: [],
    inventory: { meteor: 1, freeze: 2, heal: 1 }, reward: null, elapsed: 0, freezeTime: 0, kills: 0,
  };
}
export function buildTower(state: GameState, slotId: number, type: TowerType): GameState {
  if (!Object.prototype.hasOwnProperty.call(TOWER_TYPES, type) || ['defeat', 'victory'].includes(state.phase)) return state;
  if (!SLOTS.some(slot => slot.id === slotId) || state.towers.some(tower => tower.slotId === slotId)) return state;
  if (state.diamonds < TOWER_TYPES[type].cost) return state;
  return { ...state, diamonds: state.diamonds - TOWER_TYPES[type].cost,
    towers: [...state.towers, { id: `tower-${slotId}`, slotId, type, level: 1, cooldown: 0 }] };
}
export function upgradeCost(tower: Tower): number { return Math.floor(TOWER_TYPES[tower.type].cost * .7 * tower.level); }
export function upgradeTower(state: GameState, towerId: string): GameState {
  const tower = state.towers.find(candidate => candidate.id === towerId);
  if (!tower || tower.level >= MAX_TOWER_LEVEL || ['defeat', 'victory'].includes(state.phase) || state.diamonds < upgradeCost(tower)) return state;
  return { ...state, diamonds: state.diamonds - upgradeCost(tower),
    towers: state.towers.map(candidate => candidate.id === towerId ? { ...candidate, level: candidate.level + 1 } : candidate) };
}
export function sellTower(state: GameState, towerId: string): GameState {
  const tower = state.towers.find(candidate => candidate.id === towerId);
  if (!tower || ['defeat', 'victory'].includes(state.phase)) return state;
  const spent = TOWER_TYPES[tower.type].cost + Array.from({ length: tower.level - 1 }, (_, index) => Math.floor(TOWER_TYPES[tower.type].cost * .7 * (index + 1))).reduce((sum, cost) => sum + cost, 0);
  return { ...state, diamonds: state.diamonds + Math.floor(spent * .6), towers: state.towers.filter(candidate => candidate.id !== towerId) };
}
export function startWave(state: GameState): GameState {
  if (!['preparing', 'reward'].includes(state.phase) || state.wave >= WAVES_PER_REGION) return state;
  const wave = state.wave + 1;
  const count = 4 + wave + state.regionIndex * 2;
  const campaignStage = state.regionIndex * WAVES_PER_REGION + wave - 1;
  const commonHp = Math.round(48 * 1.1 ** campaignStage);
  const enemies: Enemy[] = Array.from({ length: count }, (_, index) => {
    const isChieftain = wave === WAVES_PER_REGION && index === count - 1;
    const isAxeman = !isChieftain && wave >= 2 && index % 3 === 1;
    const kind = isChieftain ? 'chieftain' : isAxeman ? 'axeman' : 'clubber';
    const strength = isChieftain ? 3 : isAxeman ? 1.5 : 1;
    const speed = 37 + wave * 2 + state.regionIndex * 3;
    return { id: wave * 100 + index, distance: -index * 95,
      hp: commonHp * strength, maxHp: commonHp * strength,
      speed: speed * (isChieftain ? .75 : isAxeman ? 1.04 : 1),
      kind, slow: 0 };
  });
  return { ...state, wave, phase: 'wave', enemies, reward: null, shots: [] };
}
function moveEnemies(state: GameState, dt: number): Enemy[] {
  return state.enemies.map(enemy => ({ ...enemy, slow: Math.max(0, enemy.slow - dt),
    distance: enemy.distance + enemy.speed * dt * (state.freezeTime > 0 ? EFFECTS.freezeSpeed : enemy.slow > 0 ? EFFECTS.frostSpeed : 1) }));
}
function fireTowers(towers: Tower[], moved: Enemy[], dt: number): { towers: Tower[]; enemies: Enemy[]; shots: Shot[] } {
  let enemies = moved;
  let shots: Shot[] = [];
  const updated = towers.map(tower => {
    const cooldown = Math.max(0, tower.cooldown - dt);
    if (cooldown > 0) return { ...tower, cooldown };
    const position = SLOTS.find(slot => slot.id === tower.slotId)!;
    const stats = towerStats(tower.type, tower.level);
    const target = enemies.filter(enemy => enemy.hp > 0 && enemy.distance >= 0 && enemy.distance < PATH_LENGTH)
      .find(enemy => { const point = pointOnPath(enemy.distance); return Math.hypot(point.x - position.x, point.y - position.y) <= stats.range; });
    if (!target) return { ...tower, cooldown: 0 };
    const point = pointOnPath(target.distance);
    const damage = stats.damage;
    enemies = enemies.map(enemy => {
      const hit = enemy.id === target.id || (tower.type === 'cannon' && enemy.distance >= 0 && Math.abs(enemy.distance - target.distance) < EFFECTS.splashDistance);
      return hit ? { ...enemy, hp: enemy.hp - damage, slow: tower.type === 'frost' ? EFFECTS.frostSeconds : enemy.slow } : enemy;
    });
    shots = [...shots, { from: { x: position.x, y: position.y - 27 }, to: point, type: tower.type, life: .2 }];
    return { ...tower, cooldown: stats.interval };
  });
  return { towers: updated, enemies, shots };
}
export function getWaveReward(regionIndex: number, wave: number): { diamonds: number; item: Spell | null } {
  const supplies = wave === WAVES_PER_REGION ? 180 + regionIndex * 60 : 0;
  return { diamonds: 40 + wave * 8 + regionIndex * 12 + supplies, item: wave === 3 ? 'freeze' : wave === WAVES_PER_REGION ? 'meteor' : null };
}
function completeWave(state: GameState): GameState {
  const { diamonds, item } = getWaveReward(state.regionIndex, state.wave);
  return { ...state, phase: state.wave === WAVES_PER_REGION ? 'victory' : 'reward',
    diamonds: state.diamonds + diamonds, reward: { diamonds, item },
    inventory: item ? { ...state.inventory, [item]: state.inventory[item] + 1 } : state.inventory };
}
export function tickGame(state: GameState, deltaSeconds: number): GameState {
  if (state.phase !== 'wave' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state;
  const dt = Math.min(.1, deltaSeconds);
  const combat = fireTowers(state.towers, moveEnemies(state, dt), dt);
  const escaped = combat.enemies.filter(enemy => enemy.hp > 0 && enemy.distance >= PATH_LENGTH);
  const killed = combat.enemies.filter(enemy => enemy.hp <= 0).length;
  const next: GameState = { ...state, towers: combat.towers,
    enemies: combat.enemies.filter(enemy => enemy.hp > 0 && enemy.distance < PATH_LENGTH),
    shots: [...state.shots.map(shot => ({ ...shot, life: shot.life - dt })).filter(shot => shot.life > 0), ...combat.shots],
    lives: Math.max(0, state.lives - escaped.reduce((loss, enemy) => loss + (enemy.kind === 'chieftain' ? 3 : 1), 0)),
    kills: state.kills + killed, elapsed: state.elapsed + dt, freezeTime: Math.max(0, state.freezeTime - dt) };
  if (next.lives === 0) return { ...next, phase: 'defeat', enemies: [], shots: [] };
  return next.enemies.length === 0 ? completeWave(next) : next;
}
export function useSpell(state: GameState, spell: Spell): GameState {
  if (state.phase !== 'wave' || !Object.prototype.hasOwnProperty.call(state.inventory, spell) || state.inventory[spell] < 1 || (spell === 'heal' && state.lives >= 20)) return state;
  const next = { ...state, inventory: { ...state.inventory, [spell]: state.inventory[spell] - 1 } };
  if (spell === 'heal') return { ...next, lives: Math.min(EFFECTS.maxHealth, state.lives + EFFECTS.healHealth) };
  if (spell === 'freeze') return { ...next, freezeTime: EFFECTS.freezeSeconds };
  return { ...next, enemies: state.enemies.map(enemy => enemy.distance >= 0 ? { ...enemy, hp: enemy.hp - meteorDamage(state.regionIndex) } : enemy) };
}
export function advanceRegion(state: GameState): GameState {
  if (state.phase !== 'victory' || state.regionIndex >= REGIONS.length - 1) return state;
  return { ...createGame(state.regionIndex + 1, state.diamonds), inventory: { ...state.inventory } };
}
