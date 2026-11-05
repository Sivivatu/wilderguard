import { loadTerrainArt } from './terrain-art';
import { pathForRegion, pathLengthForRegion } from './region-geometry';
import { drawSoldier } from './soldier-art';
import { loadOrcArt, type OrcArt } from './orc-art';
import { drawFrostBurst } from './frost-nova-art';
import { drawCastleHealth, drawDamageEffects, drawHealthBar, drawThrownAxe } from './structure-art';
import { SLOTS, TOWER_TYPES, pointOnPath, type GameState, type TowerType } from './game';

export const MAP_WIDTH = 1100;
export const MAP_HEIGHT = 600;
type Context = CanvasRenderingContext2D;
const roadColors = [
  ['#6e664b', '#a78d61', '#c0a575', '#ccb58a'],
  ['#384b31', '#6d6546', '#8b7c55', '#9e8f66'],
  ['#805737', '#aa7950', '#c29563', '#d3ab76'],
  ['#687e89', '#91a8b5', '#b9cbd1', '#d4e1e3'],
  ['#53594e', '#7b8071', '#a0a28c', '#b5b59e'],
] as const;
const random = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function polygon(ctx: Context, points: number[][], fill: string, stroke?: string) {
  ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function castle(ctx: Context) {
  ctx.save(); ctx.translate(1045, 408);
  ellipse(ctx, 2, 19, 62, 21, '#3c633d26');
  ctx.fillStyle = '#c2c2a3'; ctx.fillRect(-43, -32, 86, 46);
  ctx.fillStyle = '#e6e2be'; ctx.fillRect(-45, -37, 85, 45);
  ctx.fillStyle = '#afa88a'; ctx.fillRect(30, -37, 13, 48);
  for (const x of [-47, 28]) {
    ctx.fillStyle = '#d6d6b2'; ctx.fillRect(x, -66, 25, 79);
    ctx.fillStyle = '#ebe5c5'; ctx.fillRect(x, -66, 17, 73);
    polygon(ctx, [[x - 5, -65], [x + 12, -99], [x + 30, -65]], '#416f63');
    polygon(ctx, [[x - 5, -65], [x + 12, -99], [x + 12, -65]], '#5b8973');
    ctx.fillStyle = '#727f69'; ctx.fillRect(x + 9, -49, 6, 12);
  }
  ctx.fillStyle = '#ebe5c5'; ctx.fillRect(-16, -88, 33, 85);
  polygon(ctx, [[-22, -87], [0, -124], [23, -87]], '#426d5b');
  polygon(ctx, [[-22, -87], [0, -124], [0, -87]], '#6d9272');
  ctx.fillStyle = '#7b835e'; ctx.fillRect(-5, -69, 9, 15);
  ctx.fillStyle = '#5d6751'; ctx.beginPath(); ctx.moveTo(-11, 13); ctx.lineTo(-11, -8); ctx.arc(1, -8, 12, Math.PI, 0); ctx.lineTo(13, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9b763'; ctx.fillRect(-1, -147, 3, 27);
  polygon(ctx, [[2, -147], [28, -139], [2, -131]], '#d4a847');
  ctx.restore();
}
function drawRoad(ctx: Context, regionIndex: number) {
  const colors = roadColors[regionIndex];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); pathForRegion(regionIndex).forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); };
  path(); ctx.strokeStyle = colors[0] + 'a0'; ctx.lineWidth = 57; ctx.stroke();
  path(); ctx.strokeStyle = colors[1]; ctx.lineWidth = 48; ctx.stroke();
  path(); ctx.strokeStyle = colors[2]; ctx.lineWidth = 40; ctx.stroke();
  path(); ctx.strokeStyle = colors[3]; ctx.lineWidth = 26; ctx.stroke();
  for (let i = 0; i < pathLengthForRegion(regionIndex) / 19; i += 1) {
    const point = pointOnPath(i * 19, regionIndex);
    ctx.fillStyle = colors[0] + '60';
    ctx.fillRect(Math.round(point.x + random(i + 3) * 24 - 12), Math.round(point.y + random(i + 12) * 24 - 12), 3, 2);
  }
}
function background(ctx: Context, regionIndex: number, terrain: HTMLImageElement | undefined) {
  ctx.fillStyle = '#a6b48b'; ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  if (terrain) { ctx.imageSmoothingEnabled = false; ctx.drawImage(terrain, 0, 0, MAP_WIDTH, MAP_HEIGHT); }
  drawRoad(ctx, regionIndex);
  castle(ctx);
}
export function drawTower(ctx: Context, x: number, y: number, type: TowerType, level = 1, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(ctx, 5, 12, 29, 10, '#31543835');
  ellipse(ctx, 0, 8, 25, 11, '#8b9875'); ellipse(ctx, 0, 3, 25, 10, '#d0cc9e');
  ctx.fillStyle = '#c1b78b'; ctx.fillRect(-17, -35, 34, 37);
  ctx.fillStyle = '#e0d7ad'; ctx.fillRect(-17, -35, 23, 37);
  ctx.fillStyle = '#978d68'; ctx.fillRect(-4, -12, 8, 14);
  if (type === 'archer') {
    ctx.fillStyle = '#a2ae7b'; ctx.fillRect(-23, -44, 46, 16);
    for (const x1 of [-23, -5, 13]) { ctx.fillStyle = '#c5cf96'; ctx.fillRect(x1, -51, 10, 15); }
    polygon(ctx, [[-25, -44], [0, -73], [25, -44]], '#3d7354');
    polygon(ctx, [[-25, -44], [0, -73], [0, -44]], '#5b9064');
    ctx.strokeStyle = '#d7b46c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(4, -51, 11, -.9, .9); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(11, -60); ctx.lineTo(11, -42); ctx.stroke();
  } else if (type === 'cannon') {
    ctx.fillStyle = '#a28860'; ctx.fillRect(-24, -39, 48, 13);
    ellipse(ctx, 0, -40, 20, 9, '#c1a06c');
    ctx.save(); ctx.translate(0, -43); ctx.rotate(-.48);
    ctx.fillStyle = '#47514a'; ctx.fillRect(-9, -25, 18, 31); ellipse(ctx, 0, -25, 12, 6, '#657066'); ellipse(ctx, 0, -25, 7, 3, '#293c32'); ctx.restore();
    ellipse(ctx, -15, -26, 4, 4, '#d6b578'); ellipse(ctx, 14, -26, 4, 4, '#d6b578');
  } else {
    ctx.fillStyle = '#6e9290'; ctx.fillRect(-23, -40, 46, 10);
    polygon(ctx, [[0, -84], [17, -62], [0, -39], [-17, -62]], '#b7e7dd');
    polygon(ctx, [[0, -84], [17, -62], [0, -39], [0, -62]], '#6cb6b1');
    polygon(ctx, [[0, -84], [0, -62], [-17, -62]], '#defaf0');
  }
  for (let i = 0; i < level; i += 1) { ellipse(ctx, -((level - 1) * 5) + i * 10, 13, 2.5, 2.5, '#f5d77d'); }
  ctx.restore();
}
function monster(ctx: Context, enemy: GameState['enemies'][number], art: OrcArt, regionIndex: number) {
  const pos = pointOnPath(enemy.distance, regionIndex);
  const height = enemy.kind === 'chieftain' ? 82 : enemy.kind === 'axeman' || enemy.kind === 'thrower' ? 66 : 60;
  const image = art[enemy.kind];
  const width = Math.round(height * image.naturalWidth / image.naturalHeight);
  const bob = Math.sin(enemy.distance * .12 + enemy.id) * 1.2;
  ctx.save(); ctx.translate(Math.round(pos.x), Math.round(pos.y));
  ellipse(ctx, 0, 7, height * .2, 5, '#2a4b3044');
  if (enemy.slow > 0) {
    ctx.strokeStyle = '#b7f6ee'; ctx.lineWidth = 2;
    ctx.strokeRect(-width * .22, 3, width * .5, 6);
  }
  if ((enemy.frostNovaTime ?? 0) > 0) {
    ctx.fillStyle = '#d4f9ff';
    for (const x of [-width * .35, width * .35]) {
      ctx.fillRect(Math.round(x) - 2, -height / 2, 5, 5);
      ctx.fillRect(Math.round(x) - 2, -height / 2 - 4, 2, 13);
    }
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.round(-width * .63), Math.round(8 - height + bob), width, height);
  if (enemy.hp < enemy.maxHp) {
    const barWidth = enemy.kind === 'chieftain' ? 40 : 30;
    ctx.fillStyle = '#23382de0'; ctx.fillRect(-barWidth / 2 - 1, -height - 1, barWidth + 2, 6);
    ctx.fillStyle = '#dbe891'; ctx.fillRect(-barWidth / 2, -height, barWidth * Math.max(0, enemy.hp / enemy.maxHp), 4);
  }
  ctx.restore();
}
export class GameRenderer {
  private ctx: Context;
  private backgroundCanvas: HTMLCanvasElement;
  private lastRegion = -1;
  private width = 0;
  private orcArt: OrcArt | null = null;
  private terrainArt: HTMLImageElement[] = [];
  artworkError = 'Battlefield artwork could not load. Reload to try again.';
  artworkStatus: 'loading' | 'ready' | 'error' = 'loading';
  readonly ready: Promise<void>;
  constructor(private canvas: HTMLCanvasElement) {
    this.canvas.dataset.artwork = 'loading';
    this.ready = Promise.all([loadOrcArt(), loadTerrainArt()]).then(([orcs, terrain]) => {
      this.orcArt = orcs; this.terrainArt = terrain; this.lastRegion = -1;
      this.artworkStatus = 'ready'; this.canvas.dataset.artwork = 'ready';
    }).catch((error: unknown) => {
      this.artworkStatus = 'error'; this.canvas.dataset.artwork = 'error';
      this.artworkError = error instanceof Error ? error.message : this.artworkError;
      throw error;
    });
    this.ctx = canvas.getContext('2d')!;
    this.backgroundCanvas = document.createElement('canvas');
    this.backgroundCanvas.width = MAP_WIDTH; this.backgroundCanvas.height = MAP_HEIGHT;
  }
  draw(state: GameState, selectedSlot: number | null, selectedType: TowerType, time: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(this.canvas.clientWidth * dpr);
    if (this.width !== width) { this.width = width; this.canvas.width = width; this.canvas.height = Math.round(width * MAP_HEIGHT / MAP_WIDTH); }
    const ctx = this.ctx; ctx.setTransform(this.canvas.width / MAP_WIDTH, 0, 0, this.canvas.height / MAP_HEIGHT, 0, 0);
    if (this.lastRegion !== state.regionIndex) { background(this.backgroundCanvas.getContext('2d')!, state.regionIndex, this.terrainArt[state.regionIndex]); this.lastRegion = state.regionIndex; }
    ctx.drawImage(this.backgroundCanvas, 0, 0);
    for (const slot of SLOTS) {
      const tower = state.towers.find(t => t.slotId === slot.id);
      if (selectedSlot === slot.id) {
        const range = TOWER_TYPES[tower?.type || selectedType].range + ((tower?.level || 1) - 1) * 15;
        ellipse(ctx, slot.x, slot.y, range, range, '#f8f4ca20'); ctx.strokeStyle = '#fff8d177'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (tower) {
        drawTower(ctx, slot.x, slot.y, tower.type, tower.level);
        drawHealthBar(ctx, slot.x - 23, slot.y - 92, 46, tower.hp, tower.maxHp);
      }
      else {
        ellipse(ctx, slot.x, slot.y + 3, 25, 15, '#42614326'); ellipse(ctx, slot.x, slot.y, 24, 14, '#f1edce9c');
        ctx.strokeStyle = '#fff9dcab'; ctx.lineWidth = 1.7; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.ellipse(slot.x, slot.y, 25, 15, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#638358'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(slot.x - 6, slot.y); ctx.lineTo(slot.x + 6, slot.y); ctx.moveTo(slot.x, slot.y - 5); ctx.lineTo(slot.x, slot.y + 5); ctx.stroke();
      }
    }
    if (this.orcArt) {
      const art = this.orcArt;
      state.enemies.filter(enemy => enemy.distance >= 0).sort((a, b) => pointOnPath(a.distance, state.regionIndex).y - pointOnPath(b.distance, state.regionIndex).y).forEach(enemy => monster(ctx, enemy, art, state.regionIndex));
    }
    for (const soldier of state.soldiers) drawSoldier(ctx, soldier, state.regionIndex);
    for (const shot of state.shots) {
      if (shot.type === 'axe') { drawThrownAxe(ctx, shot); continue; }
      ctx.globalAlpha = Math.max(0, shot.life / .2); ctx.strokeStyle = shot.type === 'frost' ? '#d4f9f4' : shot.type === 'cannon' ? '#ffe0a2' : '#faf0b9'; ctx.lineWidth = shot.type === 'cannon' ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(shot.from.x, shot.from.y); ctx.lineTo(shot.to.x, shot.to.y); ctx.stroke(); ellipse(ctx, shot.to.x, shot.to.y, 5, 5, ctx.strokeStyle); ctx.globalAlpha = 1;
    }
    for (const burst of state.frostBursts) drawFrostBurst(ctx, burst);
    drawCastleHealth(ctx, state);
    drawDamageEffects(ctx, state.damageEvents);
    if (state.freezeTime > 0) { ctx.fillStyle = '#b8eff222'; ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT); }
    // Drifting flecks of light, subtle enough to leave the defenses in focus.
    for (let i = 0; i < 8; i += 1) { const x = (random(i + 600) * 1100 + time * 5) % 1100; const y = random(i + 700) * 600 + Math.sin(time * .4 + i) * 12; ellipse(ctx, x, y, 1.5, 1.5, '#fff7d77a'); }
  }
  getSlot(clientX: number, clientY: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * MAP_WIDTH; const y = (clientY - rect.top) / rect.height * MAP_HEIGHT;
    return SLOTS.find(slot => Math.hypot(slot.x - x, slot.y - y) < 37)?.id ?? null;
  }
}
