import type { DamageEvent, Enemy, Point, Shot, Tower, TowerType } from './game';
import { BUILD_SLOTS, pathLengthForRegion, pointOnRegionPath } from './region-geometry';

const BASE_TOWER_HEALTH: Record<TowerType, number> = { archer: 180, cannon: 220, frost: 170 };
const HEALTH_PER_LEVEL = 80;
const REPAIR_COST_FRACTION = .25;
export const DAMAGE_FEEDBACK_SECONDS = 2.4;
export const AXE_THROWER = { range: 175, interval: 2, damage: 8, regionDamage: 2, shotLife: .45 } as const;

export function towerMaxHealth(type: TowerType, level: number): number {
  return BASE_TOWER_HEALTH[type] + HEALTH_PER_LEVEL * (level - 1);
}

export function normalizeTowerHealth(tower: Tower): Tower {
  const maxHp = towerMaxHealth(tower.type, tower.level);
  const hp = Number.isFinite(tower.hp) ? Math.max(0, Math.min(maxHp, tower.hp)) : maxHp;
  return { ...tower, hp, maxHp };
}

export function calculateRepairCost(tower: Tower, buildCost: number): number {
  const health = normalizeTowerHealth(tower);
  const missingFraction = (health.maxHp - health.hp) / health.maxHp;
  return missingFraction > 0 ? Math.max(1, Math.ceil(buildCost * REPAIR_COST_FRACTION * missingFraction)) : 0;
}

function nearestTower(towers: Tower[], position: Point): Tower | undefined {
  return towers.reduce<{ tower?: Tower; distance: number }>((nearest, tower) => {
    const slot = BUILD_SLOTS.find(candidate => candidate.id === tower.slotId);
    if (!slot || tower.hp <= 0) return nearest;
    const distance = Math.hypot(slot.x - position.x, slot.y - position.y);
    return distance <= AXE_THROWER.range && distance < nearest.distance ? { tower, distance } : nearest;
  }, { distance: Infinity }).tower;
}

export function fireAxeThrowers(initialTowers: Tower[], enemies: Enemy[], dt: number, regionIndex: number): {
  towers: Tower[]; enemies: Enemy[]; shots: Shot[]; damageEvents: DamageEvent[];
} {
  let towers = initialTowers.map(normalizeTowerHealth).filter(tower => tower.hp > 0);
  let shots: Shot[] = [];
  let damageEvents: DamageEvent[] = [];
  const pathLength = pathLengthForRegion(regionIndex);
  const updated = enemies.map(enemy => {
    if (enemy.kind !== 'thrower') return enemy;
    const rangedCooldown = Math.max(0, (enemy.rangedCooldown ?? 0) - dt);
    const ready = { ...enemy, rangedCooldown };
    if (enemy.hp <= 0 || enemy.distance < 0 || enemy.distance >= pathLength || enemy.engaged || rangedCooldown > 0) return ready;
    const position = pointOnRegionPath(regionIndex, enemy.distance);
    const target = nearestTower(towers, position);
    if (!target) return ready;
    const slot = BUILD_SLOTS.find(candidate => candidate.id === target.slotId)!;
    const amount = Math.min(target.hp, AXE_THROWER.damage + AXE_THROWER.regionDamage * regionIndex);
    const hp = target.hp - amount;
    towers = towers.map(tower => tower.id === target.id ? { ...tower, hp } : tower).filter(tower => tower.hp > 0);
    shots = [...shots, { from: { x: position.x, y: position.y - 22 }, to: { x: slot.x, y: slot.y - 35 }, type: 'axe', life: AXE_THROWER.shotLife }];
    damageEvents = [...damageEvents, { target: 'tower', targetId: target.id, position: { x: slot.x, y: slot.y - 35 }, amount, destroyed: hp === 0, life: DAMAGE_FEEDBACK_SECONDS }];
    return { ...ready, rangedCooldown: AXE_THROWER.interval };
  });
  return { towers, enemies: updated, shots, damageEvents };
}

export function castleDamageEvents(lives: number, remainingLives: number): DamageEvent[] {
  const amount = lives - remainingLives;
  return amount > 0 ? [{ target: 'castle', targetId: 'castle', position: { x: 1045, y: 330 },
    amount, destroyed: remainingLives === 0, life: DAMAGE_FEEDBACK_SECONDS }] : [];
}
