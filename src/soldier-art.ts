import type { Soldier } from './soldiers';
import { pointOnRegionPath } from './region-geometry';

export function drawSoldier(ctx: CanvasRenderingContext2D, soldier: Soldier, regionIndex: number) {
  const position = pointOnRegionPath(regionIndex, soldier.distance);
  const offset = soldier.id.endsWith('-1') ? 8 : -8;
  ctx.save(); ctx.translate(Math.round(position.x + offset), Math.round(position.y));
  // Crisp pixel silhouettes: steel helmet, blue tunic, shield, and sword.
  ctx.fillStyle = '#243d3e55'; ctx.fillRect(-8, 2, 18, 5);
  ctx.fillStyle = '#243743'; ctx.fillRect(-5, -5, 4, 10); ctx.fillRect(2, -5, 4, 10);
  ctx.fillStyle = soldier.level === 3 ? '#536cbb' : '#477f9b'; ctx.fillRect(-7, -20, 14, 17);
  ctx.fillStyle = '#e1bb91'; ctx.fillRect(-5, -28, 10, 8);
  ctx.fillStyle = '#c0ccd1'; ctx.fillRect(-7, -32, 14, 7); ctx.fillRect(-7, -27, 3, 9);
  ctx.fillStyle = '#687e8b'; ctx.fillRect(-7, -25, 14, 3);
  ctx.fillStyle = '#cfb160'; ctx.fillRect(-10, -17, 8, 14);
  ctx.fillStyle = '#39718b'; ctx.fillRect(-8, -15, 4, 9);
  ctx.fillStyle = '#e6e7d5'; ctx.fillRect(10, -32, 3, 20);
  ctx.fillStyle = '#c5a75d'; ctx.fillRect(7, -13, 9, 3); ctx.fillRect(10, -10, 3, 6);
  ctx.fillStyle = '#243743'; ctx.fillRect(-9, -39, 20, 4);
  ctx.fillStyle = '#8fce91'; ctx.fillRect(-8, -38, 18 * Math.max(0, soldier.hp / soldier.maxHp), 2);
  ctx.restore();
}
