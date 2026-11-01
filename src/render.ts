import { loadOrcArt, type OrcArt } from './orc-art';
import { PATH, SLOTS, TOWER_TYPES, pointOnPath, type GameState, type TowerType } from './game';

export const MAP_WIDTH = 1100;
export const MAP_HEIGHT = 600;
type Context = CanvasRenderingContext2D;
const palettes = [
  { ground: '#a6c787', patch: '#b8d498', dark: '#3b7453', tree: '#477c50', light: '#699a5d', river: '#8ec4bf' },
  { ground: '#91b18c', patch: '#a3bf96', dark: '#285d4c', tree: '#386d51', light: '#558762', river: '#7db4b0' },
  { ground: '#c3b17e', patch: '#d3c496', dark: '#776d42', tree: '#7d8950', light: '#a0a35e', river: '#86b6ae' },
  { ground: '#bfd2cc', patch: '#d5e2d9', dark: '#426a65', tree: '#5f8b7e', light: '#91b7a3', river: '#97bdcc' },
  { ground: '#aaa998', patch: '#bdb9a3', dark: '#525c53', tree: '#67755d', light: '#8c9670', river: '#8ba7b2' },
];
const random = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function polygon(ctx: Context, points: number[][], fill: string, stroke?: string) {
  ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function tree(ctx: Context, x: number, y: number, scale: number, palette: typeof palettes[0], pine = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(ctx, 7, 12, 24, 10, '#294e2a20');
  ctx.fillStyle = '#76694b'; ctx.fillRect(-4, -15, 8, 27);
  if (pine) {
    polygon(ctx, [[-28, -5], [0, -57], [28, -5]], palette.dark);
    polygon(ctx, [[-24, -20], [0, -70], [24, -20]], palette.tree);
    polygon(ctx, [[-18, -37], [0, -78], [18, -37]], palette.light);
  } else {
    ellipse(ctx, 0, -25, 28, 27, palette.dark);
    ellipse(ctx, -13, -38, 22, 22, palette.tree);
    ellipse(ctx, 11, -40, 22, 26, palette.tree);
    ellipse(ctx, -6, -49, 20, 18, palette.light);
    ellipse(ctx, -11, -52, 9, 5, '#ffffff12');
  }
  ctx.restore();
}
function rock(ctx: Context, x: number, y: number, scale: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(ctx, 3, 4, 17, 6, '#40583f15');
  polygon(ctx, [[-16, 1], [-12, -13], [2, -20], [14, -11], [17, 2], [2, 7]], '#91a08a');
  polygon(ctx, [[-12, -13], [2, -20], [14, -11], [0, -6]], '#b5bd9f');
  polygon(ctx, [[0, -6], [14, -11], [17, 2], [2, 7]], '#7d8b77'); ctx.restore();
}
function house(ctx: Context, x: number, y: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(ctx, 5, 8, 28, 9, '#335a3b25');
  ctx.fillStyle = '#f0d8aa'; ctx.fillRect(-20, -22, 40, 29);
  ctx.fillStyle = '#c5a77d'; ctx.fillRect(8, -22, 12, 29);
  polygon(ctx, [[-26, -23], [0, -45], [26, -23]], '#91664b');
  polygon(ctx, [[-26, -23], [0, -45], [1, -24]], '#b38359');
  ctx.fillStyle = '#675e43'; ctx.fillRect(-6, -9, 10, 16);
  ctx.fillStyle = '#b4c8b0'; ctx.fillRect(-15, -16, 7, 7);
  ctx.fillStyle = '#847353'; ctx.fillRect(10, -45, 6, 15); ctx.restore();
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
function drawRoad(ctx: Context) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); PATH.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); };
  path(); ctx.strokeStyle = '#7a956655'; ctx.lineWidth = 57; ctx.stroke();
  path(); ctx.strokeStyle = '#c3b887'; ctx.lineWidth = 48; ctx.stroke();
  path(); ctx.strokeStyle = '#e5d5a6'; ctx.lineWidth = 40; ctx.stroke();
  path(); ctx.strokeStyle = '#eadbb2'; ctx.lineWidth = 26; ctx.stroke();
  for (let i = 0; i < 100; i += 1) {
    const point = pointOnPath(i * 19);
    ellipse(ctx, point.x + random(i + 3) * 22 - 11, point.y + random(i + 12) * 22 - 11, 1.5 + random(i) * 2, 1.2, '#c8b88a65');
  }
}
function nearPath(x: number, y: number, distance: number) {
  return PATH.slice(1).some((b, i) => {
    const a = PATH[i]; const dx = b.x - a.x; const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a.x - t * dx, y - a.y - t * dy) < distance;
  });
}
function background(ctx: Context, regionIndex: number) {
  const p = palettes[regionIndex]; ctx.fillStyle = p.ground; ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  for (let i = 0; i < 28; i += 1) {
    ellipse(ctx, random(i + 2) * 1100, random(i + 104) * 600, 40 + random(i) * 160, 20 + random(i + 9) * 65, i % 2 ? p.patch + '95' : p.dark + '09');
  }
  // River, fed by the hills in the north.
  ctx.beginPath(); ctx.moveTo(905, -40); ctx.bezierCurveTo(1010, 100, 906, 235, 955, 360); ctx.bezierCurveTo(1023, 470, 918, 510, 970, 650);
  ctx.strokeStyle = '#638d8540'; ctx.lineWidth = 59; ctx.stroke(); ctx.strokeStyle = p.river; ctx.lineWidth = 45; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(905, -40); ctx.bezierCurveTo(1010, 100, 906, 235, 955, 360); ctx.bezierCurveTo(1023, 470, 918, 510, 970, 650);
  ctx.strokeStyle = '#c1ded03b'; ctx.lineWidth = 27; ctx.stroke();
  for (const [x, y] of [[938, 80], [952, 160], [935, 280], [976, 380], [968, 494], [945, 562]]) {
    ctx.strokeStyle = '#e1f0d976'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x, y + 3, x + 9, y); ctx.stroke();
  }
  drawRoad(ctx);
  // Weathered timber bridge.
  ctx.save(); ctx.translate(958, 433); ctx.rotate(-.18);
  ctx.fillStyle = '#7b7151'; ctx.fillRect(-30, -30, 60, 60);
  for (let i = 0; i < 7; i += 1) { ctx.fillStyle = i % 2 ? '#bea379' : '#ceb58b'; ctx.fillRect(-29 + i * 8.5, -28, 7, 55); }
  ctx.fillStyle = '#786d4f'; ctx.fillRect(-33, -31, 66, 5); ctx.fillRect(-33, 26, 66, 5); ctx.restore();
  // Deterministic details keep the world still between frames.
  for (let i = 0; i < 260; i += 1) {
    const x = random(i * 2 + 7) * 1100; const y = random(i * 3 + 80) * 600;
    if (nearPath(x, y, 34) || SLOTS.some(slot => Math.hypot(slot.x - x, slot.y - y) < 48) || x > 895) continue;
    if (i % 4 === 0) {
      ctx.strokeStyle = p.dark + '40'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 5, y - 5); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 7); ctx.moveTo(x + 3, y); ctx.lineTo(x + 5, y - 4); ctx.stroke();
    } else if (i % 11 === 0) rock(ctx, x, y, .5 + random(i) * .3);
    else if (i % 5 === 0) { ellipse(ctx, x, y, 2, 2, '#eadb9e'); ellipse(ctx, x + 7, y + 3, 1.5, 1.5, '#f4e9c1'); }
  }
  const trees: { x: number; y: number; s: number; pine: boolean }[] = [];
  for (let i = 0; i < 175; i += 1) {
    const x = random(i + 300) * 1130 - 15; const y = random(i + 901) * 660 - 15;
    if (nearPath(x, y, 70) || SLOTS.some(slot => Math.hypot(slot.x - x, slot.y - y) < 66) || x > 875 && x < 1005 || x > 970 && y > 260 && y < 470) continue;
    trees.push({ x, y, s: .65 + random(i + 17) * .55, pine: random(i + 5) > .56 });
  }
  trees.sort((a, b) => a.y - b.y).forEach(t => tree(ctx, t.x, t.y, t.s, p, t.pine));
  house(ctx, 540, 105, .8); house(ctx, 586, 133, .62);
  // A small pumpkin patch and a direction sign.
  for (let i = 0; i < 4; i += 1) { ellipse(ctx, 573 + i * 10, 165, 4, 3, '#c79951'); }
  ctx.fillStyle = '#8b7c54'; ctx.fillRect(94, 339, 5, 25);
  polygon(ctx, [[81, 334], [109, 334], [118, 341], [109, 348], [81, 348]], '#dbc293');
  castle(ctx);
  // Soft vignette makes the board feel like an illustrated diorama.
  const shade = ctx.createRadialGradient(540, 290, 190, 550, 300, 670); shade.addColorStop(0, '#243d2700'); shade.addColorStop(1, '#284f3422'); ctx.fillStyle = shade; ctx.fillRect(0, 0, 1100, 600);
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
function monster(ctx: Context, enemy: GameState['enemies'][number], art: OrcArt) {
  const pos = pointOnPath(enemy.distance);
  const height = enemy.kind === 'chieftain' ? 82 : enemy.kind === 'axeman' ? 66 : 60;
  const image = art[enemy.kind];
  const width = Math.round(height * image.naturalWidth / image.naturalHeight);
  const bob = Math.sin(enemy.distance * .12 + enemy.id) * 1.2;
  ctx.save(); ctx.translate(Math.round(pos.x), Math.round(pos.y));
  ellipse(ctx, 0, 7, height * .2, 5, '#2a4b3044');
  if (enemy.slow > 0) {
    ctx.strokeStyle = '#b7f6ee'; ctx.lineWidth = 2;
    ctx.strokeRect(-width * .22, 3, width * .5, 6);
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
  artworkStatus: 'loading' | 'ready' | 'error' = 'loading';
  readonly ready: Promise<void>;
  constructor(private canvas: HTMLCanvasElement) {
    this.canvas.dataset.artwork = 'loading';
    this.ready = loadOrcArt().then(art => {
      this.orcArt = art;
      this.artworkStatus = 'ready'; this.canvas.dataset.artwork = 'ready';
    }).catch((error: unknown) => {
      this.artworkStatus = 'error'; this.canvas.dataset.artwork = 'error';
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
    if (this.lastRegion !== state.regionIndex) { background(this.backgroundCanvas.getContext('2d')!, state.regionIndex); this.lastRegion = state.regionIndex; }
    ctx.drawImage(this.backgroundCanvas, 0, 0);
    for (const slot of SLOTS) {
      const tower = state.towers.find(t => t.slotId === slot.id);
      if (selectedSlot === slot.id) {
        const range = TOWER_TYPES[tower?.type || selectedType].range + ((tower?.level || 1) - 1) * 15;
        ellipse(ctx, slot.x, slot.y, range, range, '#f8f4ca20'); ctx.strokeStyle = '#fff8d177'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (tower) drawTower(ctx, slot.x, slot.y, tower.type, tower.level);
      else {
        ellipse(ctx, slot.x, slot.y + 3, 25, 15, '#42614326'); ellipse(ctx, slot.x, slot.y, 24, 14, '#f1edce9c');
        ctx.strokeStyle = '#fff9dcab'; ctx.lineWidth = 1.7; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.ellipse(slot.x, slot.y, 25, 15, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#638358'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(slot.x - 6, slot.y); ctx.lineTo(slot.x + 6, slot.y); ctx.moveTo(slot.x, slot.y - 5); ctx.lineTo(slot.x, slot.y + 5); ctx.stroke();
      }
    }
    if (this.orcArt) {
      const art = this.orcArt;
      state.enemies.filter(enemy => enemy.distance >= 0).sort((a, b) => pointOnPath(a.distance).y - pointOnPath(b.distance).y).forEach(enemy => monster(ctx, enemy, art));
    }
    for (const shot of state.shots) {
      ctx.globalAlpha = Math.max(0, shot.life / .2); ctx.strokeStyle = shot.type === 'frost' ? '#d4f9f4' : shot.type === 'cannon' ? '#ffe0a2' : '#faf0b9'; ctx.lineWidth = shot.type === 'cannon' ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(shot.from.x, shot.from.y); ctx.lineTo(shot.to.x, shot.to.y); ctx.stroke(); ellipse(ctx, shot.to.x, shot.to.y, 5, 5, ctx.strokeStyle); ctx.globalAlpha = 1;
    }
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
