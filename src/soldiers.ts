import type { Enemy, GameState } from './game';
import { BUILD_SLOTS, nearestRegionDistance, pathLengthForRegion } from './region-geometry';

export interface Soldier {
  id: string;
  deploymentId: string;
  towerId: string;
  distance: number;
  hp: number;
  maxHp: number;
  level: number;
  cooldown: number;
}
export interface Deployment { id: string; towerId: string; cost: number }
export type SoldierEnemy = Enemy & { engaged?: boolean; meleeCooldown?: number };
export type SoldierGameState = GameState & {
  soldierTrainingLevel: number;
  soldiers: Soldier[];
  deployments: Deployment[];
  reward: (NonNullable<GameState['reward']> & { soldierRefund?: number }) | null;
};
export const SOLDIERS = { squadSize: 2, deployCost: 30, maxLevel: 3, moveSpeed: 45, reach: 26 } as const;
const TRAINING_STATS = [
  { hp: 50, damage: 10, interval: .8 },
  { hp: 80, damage: 16, interval: .8 },
  { hp: 120, damage: 24, interval: .8 },
] as const;
const TRAINING_COSTS = [35, 70, 0] as const;
const ENEMY_ATTACK_INTERVAL = 1;
const ENEMY_BASE_DAMAGE = 8;
const ENEMY_REGION_DAMAGE = 3;
const ENEMY_DAMAGE_MULTIPLIER = { clubber: 1, axeman: 1.3, chieftain: 2 } as const;

function isTrainingLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= SOLDIERS.maxLevel;
}

export function soldierStats(level: number): { hp: number; damage: number; interval: number } {
  return { ...TRAINING_STATS[isTrainingLevel(level) ? level - 1 : 0] };
}

export function trainingCost(level: number): number {
  return isTrainingLevel(level) ? TRAINING_COSTS[level - 1] : 0;
}

export function trainSoldiers(state: SoldierGameState): SoldierGameState {
  const level = state.soldierTrainingLevel;
  if (!['preparing', 'wave', 'reward'].includes(state.phase) || !isTrainingLevel(level) || level >= SOLDIERS.maxLevel) return state;
  const cost = trainingCost(level);
  if (!Number.isFinite(state.diamonds) || state.diamonds < cost) return state;
  return { ...state, soldierTrainingLevel: level + 1, diamonds: state.diamonds - cost };
}

export function deploySoldiers(state: SoldierGameState, towerId: string): SoldierGameState {
  if (state.phase !== 'wave' || !isTrainingLevel(state.soldierTrainingLevel)) return state;
  if (!Number.isFinite(state.diamonds) || state.diamonds < SOLDIERS.deployCost || state.deployments.some(squad => squad.towerId === towerId)) return state;
  const tower = state.towers.find(candidate => candidate.id === towerId);
  const slot = BUILD_SLOTS.find(candidate => candidate.id === tower?.slotId);
  if (!tower || !slot) return state;
  const deployment = { id: `squad-${state.regionIndex}-${state.wave}-${towerId}`, towerId, cost: SOLDIERS.deployCost };
  const stats = soldierStats(state.soldierTrainingLevel);
  const distance = nearestRegionDistance(state.regionIndex, slot.x, slot.y);
  const soldiers = Array.from({ length: SOLDIERS.squadSize }, (_, index): Soldier => ({
    id: `${deployment.id}-${index}`, deploymentId: deployment.id, towerId, distance,
    hp: stats.hp, maxHp: stats.hp, level: state.soldierTrainingLevel, cooldown: 0,
  }));
  return { ...state, diamonds: state.diamonds - deployment.cost,
    soldiers: [...state.soldiers, ...soldiers], deployments: [...state.deployments, deployment] };
}

function isWithinReach(soldier: Soldier, enemy: SoldierEnemy, pathLength: number): boolean {
  return soldier.hp > 0 && enemy.hp > 0 && enemy.distance >= 0 && enemy.distance < pathLength
    && Math.abs(enemy.distance - soldier.distance) <= SOLDIERS.reach;
}

function soldierAttacks(soldiers: Soldier[], initialEnemies: SoldierEnemy[], pathLength: number, dt: number) {
  let enemies = initialEnemies;
  const updated = soldiers.filter(soldier => soldier.hp > 0).map(soldier => {
    const cooldown = Math.max(0, soldier.cooldown - dt);
    const target = enemies.find(enemy => isWithinReach(soldier, enemy, pathLength));
    if (!target) return { ...soldier, cooldown, distance: Math.max(0, soldier.distance - SOLDIERS.moveSpeed * dt) };
    if (cooldown > 0) return { ...soldier, cooldown };
    const stats = soldierStats(soldier.level);
    enemies = enemies.map(enemy => enemy.id === target.id ? { ...enemy, hp: enemy.hp - stats.damage } : enemy);
    return { ...soldier, cooldown: stats.interval };
  });
  return { soldiers: updated, enemies };
}

function enemyAttacks(initialSoldiers: Soldier[], enemies: SoldierEnemy[], regionIndex: number, pathLength: number) {
  let soldiers = initialSoldiers;
  const updated = enemies.map(enemy => {
    const target = soldiers.find(soldier => isWithinReach(soldier, enemy, pathLength));
    if (!target || (enemy.meleeCooldown ?? 0) > 0) return enemy;
    const damage = (ENEMY_BASE_DAMAGE + ENEMY_REGION_DAMAGE * regionIndex) * ENEMY_DAMAGE_MULTIPLIER[enemy.kind];
    soldiers = soldiers.map(soldier => soldier.id === target.id ? { ...soldier, hp: soldier.hp - damage } : soldier);
    return { ...enemy, meleeCooldown: ENEMY_ATTACK_INTERVAL };
  });
  const survivors = soldiers.filter(soldier => soldier.hp > 0);
  return { soldiers: survivors, enemies: updated.map(enemy => ({ ...enemy,
    engaged: survivors.some(soldier => isWithinReach(soldier, enemy, pathLength)),
  })) };
}

export function tickSoldiers(state: SoldierGameState, deltaSeconds: number): { soldiers: Soldier[]; enemies: SoldierEnemy[] } {
  if (state.phase !== 'wave' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { soldiers: state.soldiers, enemies: state.enemies };
  const dt = Math.min(.1, deltaSeconds);
  const pathLength = pathLengthForRegion(state.regionIndex);
  const enemies = state.enemies.map((enemy: SoldierEnemy) => ({ ...enemy, engaged: false, meleeCooldown: Math.max(0, (enemy.meleeCooldown ?? 0) - dt) }));
  const attacked = soldierAttacks(state.soldiers, enemies, pathLength, dt);
  return enemyAttacks(attacked.soldiers, attacked.enemies, state.regionIndex, pathLength);
}

export function refundForDeployment(deployment: Deployment, survivors: number): number {
  if (!Number.isInteger(survivors) || survivors <= 0 || !Number.isFinite(deployment.cost) || deployment.cost <= 0) return 0;
  return deployment.cost * Math.min(survivors, SOLDIERS.squadSize) / SOLDIERS.squadSize;
}

export function settleSoldiers(state: SoldierGameState): SoldierGameState {
  if (!['reward', 'victory'].includes(state.phase) || state.deployments.length === 0) return state;
  const refund = state.deployments.reduce((total, deployment) => total + refundForDeployment(deployment,
    state.soldiers.filter(soldier => soldier.deploymentId === deployment.id && soldier.hp > 0).length), 0);
  return { ...state, diamonds: state.diamonds + refund, soldiers: [], deployments: [],
    reward: state.reward ? { ...state.reward, soldierRefund: (state.reward.soldierRefund ?? 0) + refund } : null };
}
