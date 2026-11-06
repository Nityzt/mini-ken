const OUTER = "#F6D55C";
const OUTER_HOT = "#FF9F43";
const INNER = "#FFF4B8";
const WIDTH = 20;

const noise = (a: number, b: number) => (Math.imul(a * 31 + b * 17 + 7, 2654435761) >>> 0) / 4294967296;

/** Flickering flames behind a fighter powering up. They climb higher as the pressure builds. */
export function drawAuraBack(ctx: CanvasRenderingContext2D, x: number, ground: number, tick: number, power: number, reducedMotion: boolean): void {
  const frame = reducedMotion ? 0 : Math.floor(tick / 2);
  const cx = Math.round(x);
  for (let dx = -WIDTH; dx <= WIDTH; dx += 2) {
    const shape = Math.sqrt(1 - (dx / (WIDTH + 1)) ** 2);
    const height = Math.round((34 + power * 26) * shape + noise(dx, frame) * (6 + power * 10));
    // The outer flame is dithered, so the room shows through it.
    ctx.fillStyle = power > 0.66 && dx % 4 === 0 ? OUTER_HOT : OUTER;
    for (let y = 0; y < height; y += 2) {
      if ((y / 2 + dx / 2 + frame) % 2 === 0) ctx.fillRect(cx + dx, ground - y - 2, 2, 2);
    }
    if (Math.abs(dx) <= WIDTH - 6) {
      ctx.fillStyle = INNER;
      const inner = Math.round(height * 0.62);
      for (let y = 0; y < inner; y += 2) {
        if ((y / 2 + dx / 2 + frame + 1) % 2 === 0) ctx.fillRect(cx + dx, ground - y - 2, 2, 2);
      }
    }
  }
}

/** Sparks rising past the fighter, and dust kicked out from their feet. */
export function drawAuraFront(ctx: CanvasRenderingContext2D, x: number, ground: number, tick: number, power: number, reducedMotion: boolean): void {
  const time = reducedMotion ? 20 : tick;
  const cx = Math.round(x);
  const count = 6 + Math.round(power * 10);
  for (let i = 0; i < count; i++) {
    const rise = 40 + power * 30;
    const speed = 1 + (i % 3) * 0.6;
    const y = (time * speed + i * 17) % rise;
    const dx = Math.round((noise(i, 3) - 0.5) * 40);
    ctx.fillStyle = i % 2 === 0 ? "#FFFFFF" : OUTER;
    ctx.fillRect(cx + dx, Math.round(ground - y), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }
  const spread = reducedMotion ? 10 : (time % 12) + 8;
  ctx.fillStyle = "#D6CEC4";
  for (const side of [-1, 1]) {
    ctx.fillRect(cx + side * spread * 2, ground - 2, 3, 2);
    ctx.fillRect(cx + side * (spread + 10), ground - 3, 2, 2);
  }
}
