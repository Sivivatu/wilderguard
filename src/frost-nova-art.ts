import { FROST_NOVA, type FrostBurst } from './game';

export function drawFrostBurst(ctx: CanvasRenderingContext2D, burst: FrostBurst) {
  const progress = Math.min(1, Math.max(0, 1 - burst.life / FROST_NOVA.life));
  const radius = FROST_NOVA.radius * (.15 + .85 * progress);
  ctx.save();
  ctx.translate(burst.position.x, burst.position.y);
  ctx.globalAlpha = (1 - progress) * .8;
  ctx.fillStyle = '#d4f9ff';
  ctx.strokeStyle = '#a9edff';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  // Square ice shards keep the explosion close to the orcs' pixel artwork.
  for (let shard = 0; shard < 12; shard += 1) {
    const angle = shard * Math.PI / 6;
    const size = shard % 2 ? 4 : 7;
    ctx.fillRect(Math.round(Math.cos(angle) * radius) - size / 2, Math.round(Math.sin(angle) * radius) - size / 2, size, size);
  }
  ctx.restore();
}
