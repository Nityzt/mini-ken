import { PALETTE } from "./palette.ts";

/**
 * What each thing that can happen in a duel looks like. Every kind has its own shape, not just its own color,
 * so a landed cut, a blocked one, a parried one and a dud can't be mistaken for one another at a glance.
 */
export type FxKind = "strike" | "clank" | "deflect" | "dud" | "miss" | "bind" | "passing" | "shout" | "shaken" | "shatter" | "shove" | "stomp" | "ippon" | "mutual" | "fade" | "launch";
export type Fx = { kind: FxKind; x: number; y: number; dir: -1 | 1; age: number; color?: string };

/** How many frames each one lasts. */
export const FX_LIFE: Record<FxKind, number> = {
  strike: 30,
  clank: 18,
  deflect: 27,
  dud: 18,
  miss: 15,
  bind: 24,
  passing: 24,
  shout: 24,
  shaken: 30,
  shatter: 36,
  shove: 21,
  stomp: 12,
  ippon: 42,
  mutual: 27,
  fade: 24,
  launch: 15,
};

/** These go behind the fighters, because they're about the moment rather than the contact. */
export const FX_BEHIND: ReadonlySet<FxKind> = new Set<FxKind>(["ippon", "shout", "passing"]);

/** Effects move in held steps, like the fighters do, instead of sliding. */
const FX_HOLD = 3;
/** Seme and kiai's color, which nothing else uses. */
export const SPIRIT = "#B79CF0";
const GUARD = "#7FA8E8";

const DIAGONAL = 0.7;
const STAR: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [DIAGONAL, DIAGONAL], [-DIAGONAL, DIAGONAL], [DIAGONAL, -DIAGONAL], [-DIAGONAL, -DIAGONAL]];

export function drawFx(ctx: CanvasRenderingContext2D, fx: Fx, still = false): void {
  const life = FX_LIFE[fx.kind];
  // Reduced motion shows one clear frame of each, from about the middle.
  const key = still ? Math.floor(life / FX_HOLD / 2) : Math.floor(fx.age / FX_HOLD);
  const keys = Math.ceil(life / FX_HOLD);
  const { x, y, dir } = fx;
  const box = (px: number, py: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(px), Math.round(py), w, h);
  };

  switch (fx.kind) {
    // A landed cut: a white core and long rays, the biggest thing in the game.
    case "strike": {
      const reach = 5 + key * 3;
      if (key < 3) box(x - 4, y - 4, 9, 9, PALETTE.W);
      for (const [dx, dy] of STAR) {
        for (let along = Math.max(2, reach - 8); along <= reach; along += 2) box(x + dx * along - 1, y + dy * along - 1, 2, 2, along > reach - 3 && fx.color ? fx.color : PALETTE.W);
      }
      break;
    }
    // A block: a flat plate where the guard stopped it, with chips thrown back the way it came.
    case "clank": {
      box(x - 1, y - 8, 3, 16, key < 3 ? PALETTE.W : GUARD);
      for (let chip = 0; chip < 3; chip++) box(x - dir * (3 + key * 2 + chip), y - 5 + chip * 5, 2, 1, PALETTE.Y);
      break;
    }
    // A parry: a gold crescent sweeping up, knocking the blade aside.
    case "deflect": {
      const radius = 10 + key;
      for (let degrees = -110; degrees <= 20; degrees += 13) {
        const angle = (degrees * Math.PI) / 180;
        const thick = Math.abs(degrees + 45) < 40 ? 3 : 2;
        box(x + dir * Math.cos(angle) * radius, y + Math.sin(angle) * radius, thick, thick, key < 2 ? PALETTE.W : PALETTE.Y);
      }
      break;
    }
    // A strike with no stomp behind it: a small grey puff that sags, and no spark at all.
    case "dud": {
      for (const [dx, dy] of STAR) box(x + dx * 4, y + dy * 4 + key, 2, 2, key < 3 ? PALETTE.w : PALETTE.k);
      break;
    }
    // Cutting air: a few thin dashes carrying on, and nothing there.
    case "miss": {
      for (let dash = 0; dash < 3; dash++) box(x + dir * (dash * 7 + key * 2), y + dash * 2, 4, 1, PALETTE.w);
      break;
    }
    // Hilts meeting: two bars crossing, with chips coming off.
    case "bind": {
      for (let along = -6; along <= 6; along++) {
        box(x + along, y + along, 2, 2, key < 2 ? PALETTE.W : PALETTE.R);
        box(x + along, y - along, 2, 2, key < 2 ? PALETTE.W : PALETTE.R);
      }
      for (const [dx, dy] of STAR) box(x + dx * (9 + key * 2), y + dy * (9 + key * 2), 1, 1, PALETTE.Y);
      break;
    }
    // Going past each other: long streaks both ways, with no contact.
    case "passing": {
      for (let row = 0; row < 4; row++) {
        const reach = 8 + key * 6;
        const toRight = row % 2 === 0;
        box(toRight ? x + 4 : x - 4 - reach, y - 12 + row * 7, reach, 1, PALETTE.C);
      }
      break;
    }
    // A shout: one thin ring going out.
    case "shout": {
      const radius = 6 + key * 6;
      for (let degrees = 0; degrees < 360; degrees += 20) {
        const angle = (degrees * Math.PI) / 180;
        box(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.7, 2, 1, SPIRIT);
      }
      break;
    }
    // Flinching: little sparks circling the head.
    case "shaken": {
      for (let spark = 0; spark < 3; spark++) {
        const angle = ((key + spark * 3) * Math.PI) / 4.5;
        box(x + Math.cos(angle) * 9, y + Math.sin(angle) * 3 - key / 2, 2, 2, SPIRIT);
      }
      break;
    }
    // A guard giving way: red shards that fall.
    case "shatter": {
      for (let shard = 0; shard < 8; shard++) {
        const out = (shard - 3.5) * (1.2 + key * 0.6);
        const fall = key * key * 0.35 - (8 - Math.abs(shard - 3.5)) * 1.2;
        box(x + out, y + fall, shard % 2 ? 3 : 2, 2, shard % 3 === 0 ? PALETTE.W : PALETTE.R);
      }
      break;
    }
    // A shove or a charge: chevrons pointing the way it's going.
    case "shove": {
      for (let chevron = 0; chevron < 3; chevron++) {
        const at = x + dir * (chevron * 7 + key * 3);
        for (let arm = 0; arm < 4; arm++) {
          box(at - dir * arm, y - arm, 2, 1, PALETTE.W);
          box(at - dir * arm, y + arm, 2, 1, PALETTE.W);
        }
      }
      break;
    }
    // A stomp: a crack along the floor.
    case "stomp": {
      const reach = 4 + key * 4;
      box(x - reach, y, reach * 2, 1, PALETTE.w);
      box(x - reach - 1, y - 2, 1, 2, PALETTE.W);
      box(x + reach, y - 2, 1, 2, PALETTE.W);
      break;
    }
    // The point counts: gold rising behind whoever scored it.
    case "ippon": {
      for (let ray = -3; ray <= 3; ray++) {
        const height = 16 + ((ray + key) % 2 === 0 ? 34 : 22) - Math.abs(ray) * 3;
        box(x + ray * 6 - 1, y - height, 2, height, ray % 2 === 0 ? PALETTE.Y : PALETTE.y);
      }
      break;
    }
    // Both at once: two half-bursts, one each way, in each fighter's color.
    case "mutual": {
      const reach = 5 + key * 2;
      for (const [dx, dy] of STAR) {
        if (dx === 0) continue;
        box(x + dx * reach - (dx < 0 ? 4 : 0), y + dy * reach, 4, 2, dx < 0 ? PALETTE.R : PALETTE.W);
      }
      box(x, y - 8, 1, 16, PALETTE.Y);
      break;
    }
    // Stopping short: the point draining away, in dots that fall.
    case "fade": {
      for (let dot = 0; dot < 5; dot++) box(x - 8 + dot * 4, y + ((key + dot) % keys) * 2, 2, 2, PALETTE.k);
      break;
    }
    // A launch: lines left behind.
    case "launch": {
      for (let line = 0; line < 3; line++) box(x - dir * (6 + key * 3) - (dir > 0 ? 9 : 0), y - 18 + line * 8, 9, 1, PALETTE.w);
      break;
    }
  }
}

/** A guard you can see from across the court: a blue bar held in front of them. */
export function drawGuardPlate(ctx: CanvasRenderingContext2D, x: number, y: number, parrying: boolean): void {
  ctx.fillStyle = parrying ? PALETTE.W : GUARD;
  ctx.fillRect(Math.round(x), y, 2, parrying ? 20 : 14);
  ctx.fillStyle = parrying ? PALETTE.C : PALETTE.i;
  ctx.fillRect(Math.round(x) + 2, y + 2, 1, parrying ? 16 : 10);
}

/** A strip on the floor under someone, whose color says what they're doing. */
export function drawGroundStrip(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x) - 11, y, 22, 2);
}

/** How long a status has left, under its label. */
export function drawStatusBar(ctx: CanvasRenderingContext2D, x: number, y: number, left: number, color: string): void {
  const width = 20;
  const start = Math.round(x) - width / 2;
  ctx.fillStyle = PALETTE.K;
  ctx.fillRect(start - 1, y - 1, width + 2, 4);
  ctx.fillStyle = color;
  ctx.fillRect(start, y, Math.ceil(width * Math.max(0, Math.min(1, left))), 2);
}
