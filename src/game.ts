import { BUILD_SLOTS, pathForRegion, pathLengthForRegion, pointOnRegionPath } from './region-geometry';
import { settleSoldiers, tickSoldiers, type Soldier, type Deployment } from './soldiers';
import { calculateRepairCost, castleDamageEvents, fireAxeThrowers, normalizeTowerHealth, towerMaxHealth } from './tower-combat';
export { towerMaxHealth } from './tower-combat';

export type TowerType = 'archer' | 'cannon' | 'frost';
export type Spell = 'meteor' | 'freeze' | 'heal';
export type Phase = 'preparing' | 'wave' | 'reward' | 'defeat' | 'victory';
export interface Point { x: number; y: number }
export interface Tower { id: string; slotId: number; type: TowerType; level: number; cooldown: number; hp: number; maxHp: number }
export interface Enemy { id: number; distance: number; hp: number; maxHp: number; speed: number; kind: 'clubber' | 'axeman' | 'chieftain' | 'thrower'; slow: number; frostNovaTime?: number; engaged?: boolean; meleeCooldown?: number; rangedCooldown?: number }
export interface Shot { from: Point; to: Point; type: TowerType | 'axe'; life: number }
export interface FrostBurst { position: Point; life: number }
export interface DamageEvent { target: 'castle' | 'tower'; targetId: string; position: Point; amount: number; destroyed: boolean; life: number }
export interface GameState {
  regionIndex: number; diamonds: number; lives: number; wave: number; phase: Phase;
  towers: Tower[]; enemies: Enemy[]; shots: Shot[]; frostBursts: FrostBurst[]; damageEvents: DamageEvent[]; inventory: Record<Spell, number>;
  reward: { diamonds: number; item: Spell | null; soldierRefund?: number } | null;
  soldierTrainingLevel: number; soldiers: Soldier[]; deployments: Deployment[];
  elapsed: number; freezeTime: number; kills: number;
}
export const WAVES_PER_REGION = 5;
export const MAX_TOWER_LEVEL = 3;
export const EFFECTS = { frostSpeed: .5, frostSeconds: 2, freezeSpeed: .12, freezeSeconds: 6, healHealth: 6, maxHealth: 20, splashDistance: 65 } as const;
export const FROST_NOVA = { radius: 90, life: .65, level: 3 } as const;
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
export const SLOTS = BUILD_SLOTS;
// Preserve the original route exports for saved campaigns and tooling.
export const PATH = pathForRegion(0);
export const PATH_LENGTH = pathLengthForRegion(0);
export function pointOnPath(distance: number, regionIndex = 0): Point {
  return pointOnRegionPath(regionIndex, distance);
}
export function createGame(regionIndex = 0, diamonds = 120): GameState {
  return {
    regionIndex: Math.min(REGIONS.length - 1, Math.max(0, Math.floor(regionIndex) || 0)),
    diamonds: Number.isFinite(diamonds) ? Math.max(0, Math.floor(diamonds)) : 120,
    soldierTrainingLevel: 1, soldiers: [], deployments: [],
    lives: 20, wave: 0, phase: 'preparing', towers: [], enemies: [], shots: [], frostBursts: [], damageEvents: [],
    inventory: { meteor: 1, freeze: 2, heal: 1 }, reward: null, elapsed: 0, freezeTime: 0, kills: 0,
  };
}
export function buildTower(state: GameState, slotId: number, type: TowerType): GameState {
  if (!Object.prototype.hasOwnProperty.call(TOWER_TYPES, type) || ['defeat', 'victory'].includes(state.phase)) return state;
  if (!SLOTS.some(slot => slot.id === slotId) || state.towers.some(tower => tower.slotId === slotId)) return state;
  if (state.diamonds < TOWER_TYPES[type].cost) return state;
  return { ...state, diamonds: state.diamonds - TOWER_TYPES[type].cost,
    towers: [...state.towers, { id: `tower-${slotId}`, slotId, type, level: 1, cooldown: 0, hp: towerMaxHealth(type, 1), maxHp: towerMaxHealth(type, 1) }] };
}
export function upgradeCost(tower: Tower): number { return Math.floor(TOWER_TYPES[tower.type].cost * .7 * tower.level); }
export function upgradeTower(state: GameState, towerId: string): GameState {
  const tower = state.towers.find(candidate => candidate.id === towerId);
  if (!tower || tower.level >= MAX_TOWER_LEVEL || ['defeat', 'victory'].includes(state.phase) || state.diamonds < upgradeCost(tower)) return state;
  return { ...state, diamonds: state.diamonds - upgradeCost(tower),
    towers: state.towers.map(candidate => {
      if (candidate.id !== towerId) return candidate;
      const health = normalizeTowerHealth(candidate);
      const maxHp = towerMaxHealth(candidate.type, candidate.level + 1);
      return { ...health, level: candidate.level + 1, maxHp, hp: maxHp - (health.maxHp - health.hp) };
    }) };
}
export function repairCost(tower: Tower): number { return calculateRepairCost(tower, TOWER_TYPES[tower.type].cost); }
export function repairTower(state: GameState, towerId: string): GameState {
  const tower = state.towers.find(candidate => candidate.id === towerId);
  if (!tower || ['defeat', 'victory'].includes(state.phase)) return state;
  const cost = repairCost(tower);
  if (cost === 0 || state.diamonds < cost) return state;
  return { ...state, diamonds: state.diamonds - cost,
    towers: state.towers.map(candidate => candidate.id === towerId ? { ...normalizeTowerHealth(candidate), hp: towerMaxHealth(candidate.type, candidate.level) } : candidate) };
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
    const throwersUnlocked = state.regionIndex > 0 || wave >= 3;
    const isThrower = !isChieftain && throwersUnlocked && (index === Math.floor(count / 2) || state.regionIndex >= 2 && index === count - 2);
    const isAxeman = !isChieftain && !isThrower && wave >= 2 && index % 3 === 1;
    const kind = isChieftain ? 'chieftain' : isThrower ? 'thrower' : isAxeman ? 'axeman' : 'clubber';
    const strength = isChieftain ? 3 : isThrower ? 1.35 : isAxeman ? 1.5 : 1;
    const speed = 37 + wave * 2 + state.regionIndex * 3;
    return { id: wave * 100 + index, distance: -index * 95,
      hp: commonHp * strength, maxHp: commonHp * strength,
      speed: speed * (isChieftain ? .75 : isAxeman ? 1.04 : 1),
      kind, slow: 0 };
  });
  return { ...state, wave, phase: 'wave', enemies, reward: null, shots: [], frostBursts: [], damageEvents: [], soldiers: [], deployments: [] };
}
function moveEnemies(state: GameState, dt: number): Enemy[] {
  return state.enemies.map(enemy => ({ ...enemy, slow: Math.max(0, enemy.slow - dt),
    frostNovaTime: Math.max(0, (enemy.frostNovaTime ?? 0) - dt),
    distance: enemy.hp <= 0 || enemy.engaged ? enemy.distance : enemy.distance + enemy.speed * dt * (state.freezeTime > 0 ? EFFECTS.freezeSpeed : enemy.slow > 0 ? EFFECTS.frostSpeed : 1) }));
}
function fireTowers(towers: Tower[], moved: Enemy[], dt: number, regionIndex: number): { towers: Tower[]; enemies: Enemy[]; shots: Shot[] } {
  let enemies = moved;
  let shots: Shot[] = [];
  const updated = towers.map(normalizeTowerHealth).filter(tower => tower.hp > 0).map(tower => {
    const cooldown = Math.max(0, tower.cooldown - dt);
    if (cooldown > 0) return { ...tower, cooldown };
    const position = SLOTS.find(slot => slot.id === tower.slotId)!;
    const stats = towerStats(tower.type, tower.level);
    const target = enemies.filter(enemy => enemy.hp > 0 && enemy.distance >= 0 && enemy.distance < pathLengthForRegion(regionIndex))
      .find(enemy => { const point = pointOnPath(enemy.distance, regionIndex); return Math.hypot(point.x - position.x, point.y - position.y) <= stats.range; });
    if (!target) return { ...tower, cooldown: 0 };
    const point = pointOnPath(target.distance, regionIndex);
    const damage = stats.damage;
    enemies = enemies.map(enemy => {
      const hit = enemy.id === target.id || (tower.type === 'cannon' && enemy.distance >= 0 && Math.abs(enemy.distance - target.distance) < EFFECTS.splashDistance);
      return hit ? { ...enemy, hp: enemy.hp - damage, slow: tower.type === 'frost' ? EFFECTS.frostSeconds : enemy.slow,
        frostNovaTime: tower.type === 'frost' && tower.level === FROST_NOVA.level ? EFFECTS.frostSeconds : enemy.frostNovaTime } : enemy;
    });
    shots = [...shots, { from: { x: position.x, y: position.y - 27 }, to: point, type: tower.type, life: .2 }];
    return { ...tower, cooldown: stats.interval };
  });
  return { towers: updated, enemies, shots };
}
function spreadFrostOnDeath(enemies: Enemy[], regionIndex: number): { enemies: Enemy[]; bursts: FrostBurst[] } {
  const bursts = enemies.filter(enemy => enemy.hp <= 0 && (enemy.frostNovaTime ?? 0) > 0 && enemy.distance >= 0 && enemy.distance < pathLengthForRegion(regionIndex))
    .map(enemy => ({ position: pointOnPath(enemy.distance, regionIndex), life: FROST_NOVA.life }));
  if (!bursts.length) return { enemies, bursts };
  const chilled = enemies.map(enemy => {
    // Clear consumed marks so spell victims cannot burst again on the next tick.
    if (enemy.hp <= 0) return { ...enemy, frostNovaTime: 0 };
    if (enemy.distance < 0 || enemy.distance >= pathLengthForRegion(regionIndex)) return enemy;
    const position = pointOnPath(enemy.distance, regionIndex);
    const inBlast = bursts.some(burst => Math.hypot(position.x - burst.position.x, position.y - burst.position.y) <= FROST_NOVA.radius);
    return inBlast ? { ...enemy, slow: EFFECTS.frostSeconds, frostNovaTime: EFFECTS.frostSeconds } : enemy;
  });
  return { enemies: chilled, bursts };
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
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state;
  const dt = Math.min(.1, deltaSeconds);
  const frostBursts = state.frostBursts.map(burst => ({ ...burst, life: burst.life - dt })).filter(burst => burst.life > 0);
  const damageEvents = (state.damageEvents ?? []).map(event => ({ ...event, life: event.life - dt })).filter(event => event.life > 0);
  if (state.phase !== 'wave') return state.frostBursts.length || state.damageEvents?.length ? { ...state, frostBursts, damageEvents } : state;
  const melee = tickSoldiers(state, dt);
  const fired = fireTowers(state.towers, moveEnemies({ ...state, enemies: melee.enemies }, dt), dt, state.regionIndex);
  const spread = spreadFrostOnDeath(fired.enemies, state.regionIndex);
  const pathLength = pathLengthForRegion(state.regionIndex);
  const ranged = fireAxeThrowers(fired.towers, spread.enemies, dt, state.regionIndex);
  const combat = { ...ranged, shots: [...fired.shots, ...ranged.shots] };
  const escaped = combat.enemies.filter(enemy => enemy.hp > 0 && enemy.distance >= pathLength);
  const killed = combat.enemies.filter(enemy => enemy.hp <= 0).length;
  const lives = Math.max(0, state.lives - escaped.reduce((loss, enemy) => loss + (enemy.kind === 'chieftain' ? 3 : 1), 0));
  const next: GameState = { ...state, soldiers: melee.soldiers, towers: combat.towers,
    frostBursts: [...frostBursts, ...spread.bursts],
    damageEvents: [...damageEvents, ...combat.damageEvents, ...castleDamageEvents(state.lives, lives)],
    enemies: combat.enemies.filter(enemy => enemy.hp > 0 && enemy.distance < pathLength),
    shots: [...state.shots.map(shot => ({ ...shot, life: shot.life - dt })).filter(shot => shot.life > 0), ...combat.shots],
    lives,
    kills: state.kills + killed, elapsed: state.elapsed + dt, freezeTime: Math.max(0, state.freezeTime - dt) };
  if (next.lives === 0) return { ...next, phase: 'defeat', enemies: [], shots: [], frostBursts: [], soldiers: [], deployments: [] };
  return next.enemies.length === 0 ? settleSoldiers(completeWave(next)) : next;
}
export function useSpell(state: GameState, spell: Spell): GameState {
  if (state.phase !== 'wave' || !Object.prototype.hasOwnProperty.call(state.inventory, spell) || state.inventory[spell] < 1 || (spell === 'heal' && state.lives >= 20)) return state;
  const next = { ...state, inventory: { ...state.inventory, [spell]: state.inventory[spell] - 1 } };
  if (spell === 'heal') return { ...next, lives: Math.min(EFFECTS.maxHealth, state.lives + EFFECTS.healHealth) };
  if (spell === 'freeze') return { ...next, freezeTime: EFFECTS.freezeSeconds };
  const spread = spreadFrostOnDeath(state.enemies.map(enemy => enemy.distance >= 0 ? { ...enemy, hp: enemy.hp - meteorDamage(state.regionIndex) } : enemy), state.regionIndex);
  return { ...next, enemies: spread.enemies, frostBursts: [...state.frostBursts, ...spread.bursts] };
}
export function advanceRegion(state: GameState): GameState {
  if (state.phase !== 'victory' || state.regionIndex >= REGIONS.length - 1) return state;
  return { ...createGame(state.regionIndex + 1, state.diamonds), inventory: { ...state.inventory }, soldierTrainingLevel: state.soldierTrainingLevel };
}
