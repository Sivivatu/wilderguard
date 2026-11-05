import type { DamageEvent, GameState, Shot } from './game';
import { AXE_THROWER, DAMAGE_FEEDBACK_SECONDS } from './tower-combat';

type Context = CanvasRenderingContext2D;

export function drawHealthBar(ctx: Context, x: number, y: number, width: number, hp: number, maxHp: number) {
  const fraction = Math.max(0, Math.min(1, hp / maxHp));
  ctx.fillStyle = '#203b32e8'; ctx.fillRect(x - 2, y - 2, width + 4, 9);
  ctx.fillStyle = '#e9e4c6'; ctx.fillRect(x, y, width, 5);
  ctx.fillStyle = fraction > .5 ? '#7fb579' : fraction > .25 ? '#e6b86c' : '#e77a65';
  ctx.fillRect(x, y, width * fraction, 5);
}

export function drawCastleHealth(ctx: Context, state: GameState) {
  ctx.save();
  ctx.font = 'bold 12px "DM Sans", sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#203b32ec'; ctx.fillRect(984, 238, 113, 31);
  ctx.fillStyle = '#fff9df'; ctx.fillText(`CASTLE ${state.lives}/20`, 1040, 251);
  drawHealthBar(ctx, 992, 259, 96, state.lives, 20);
  ctx.restore();
}

export function drawDamageEffects(ctx: Context, events: DamageEvent[]) {
  for (const event of events) {
    const age = DAMAGE_FEEDBACK_SECONDS - event.life;
    const { x, y } = event.position;
    ctx.save();
    // A brief outline identifies the structure struck before the number floats away.
    if (age < .5) {
      ctx.strokeStyle = '#ffb08a'; ctx.lineWidth = 4; ctx.globalAlpha = 1 - age;
      ctx.strokeRect(x - 26, y - 38, 52, 66);
    }
    ctx.globalAlpha = Math.min(1, event.life);
    ctx.font = 'bold 16px "DM Sans", sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#3d241b'; ctx.fillStyle = '#ffe2b4';
    const label = event.destroyed ? 'DESTROYED' : `−${event.amount} HP`;
    const labelX = Math.min(1034, Math.max(65, x));
    ctx.strokeText(label, labelX, y - 45 - age * 12);
    ctx.fillText(label, labelX, y - 45 - age * 12);
    ctx.restore();
  }
}

export function drawThrownAxe(ctx: Context, shot: Shot) {
  const progress = Math.max(0, Math.min(1, 1 - shot.life / AXE_THROWER.shotLife));
  const x = shot.from.x + (shot.to.x - shot.from.x) * progress;
  const y = shot.from.y + (shot.to.y - shot.from.y) * progress - Math.sin(progress * Math.PI) * 20;
  ctx.save(); ctx.translate(x, y); ctx.rotate(progress * Math.PI * 4);
  ctx.fillStyle = '#38291d'; ctx.fillRect(-3, -11, 6, 25);
  ctx.fillStyle = '#b99a66'; ctx.fillRect(-1, -9, 2, 22);
  ctx.fillStyle = '#d9e2da'; ctx.fillRect(-10, -12, 19, 9); ctx.fillRect(-12, -10, 5, 8);
  ctx.fillStyle = '#7e9189'; ctx.fillRect(-8, -5, 16, 4);
  ctx.restore();
}
