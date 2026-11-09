import { drawLabelAt, drawText, measureText } from "../art/font.ts";
import { drawKendoka, FULL_GEAR, type HeldShinai } from "../art/kendoka.ts";
import { UI } from "../art/palette.ts";
import { TILE } from "../art/tiles.ts";
import { guiPoint, onGui, viewW } from "../core/scale.ts";
import { nextRandom } from "../duel/rival.ts";
import { CHAT_LINES } from "./content.ts";
import { findTiles } from "./levels.ts";
import type { Camera } from "./topdown.ts";

export type CrowdActivity = "suburi" | "keiko";
export type CrowdMember = { col: number; row: number; activity: CrowdActivity; flip: boolean; side: 0 | 1 };
export type CrowdPose = { held: HeldShinai; dx: number; frame: 0 | 1; shout: boolean };

/** One step forward with one cut, one step back with the next. */
export const SUBURI_CYCLE = 80;
/** Each of a pair attacks in turn. */
export const KEIKO_CYCLE = 200;
const SUBURI_STEP = 2;
const STANDOFF = 110;
const RAISE = 22;
const STRIKE = 24;
const LUNGE = 4;

const STILL: CrowdPose = { held: "guard", dx: 0, frame: 0, shout: false };

/** Where everyone in a suburi group is in the swing. It only depends on the time, so they stay in tandem. */
export function suburiPose(tick: number, reducedMotion: boolean): CrowdPose {
  if (reducedMotion) return STILL;
  const t = tick % SUBURI_CYCLE;
  const half = SUBURI_CYCLE / 2;
  const forward = t < half;
  const cut = t % half;
  const down = cut >= half / 2;
  return { held: down ? "strike" : "raised", dx: (forward ? down : !down) ? SUBURI_STEP : 0, frame: down ? 1 : 0, shout: false };
}

/** A pair circling, then one going for it while the other covers. Then it's the other's turn. */
export function keikoPose(tick: number, side: 0 | 1, reducedMotion: boolean): CrowdPose {
  if (reducedMotion) return STILL;
  const round = Math.floor(tick / KEIKO_CYCLE);
  const t = tick % KEIKO_CYCLE;
  const attacking = round % 2 === side;
  if (t < STANDOFF) return { held: "guard", dx: Math.floor(t / 28) % 2, frame: (Math.floor(t / 28) % 2) as 0 | 1, shout: false };
  if (t < STANDOFF + RAISE) return { held: attacking ? "raised" : "guard", dx: 0, frame: 0, shout: false };
  if (t < STANDOFF + RAISE + STRIKE) return attacking ? { held: "strike", dx: LUNGE, frame: 1, shout: true } : { held: "cover", dx: -1, frame: 0, shout: false };
  return { held: "guard", dx: 0, frame: 0, shout: false };
}

export { CHAT_LINES };
export type Activity = "suburi" | "keiko" | "footwork" | "chat" | "rest";
/** How long a group sticks with something before it picks again, in ticks: fifteen seconds. */
export const ACTIVITY_TICKS = 900;
/** How long one thing someone says stays over their head. */
export const CHAT_TICKS = 150;
const FOOTWORK_CYCLE = 48;
const FOOTWORK_STEP = 3;
/** They're here to train, so drilling comes up most often. */
const ROUTINES: Record<CrowdActivity, Activity[]> = {
  suburi: ["suburi", "suburi", "footwork", "chat", "rest"],
  keiko: ["keiko", "keiko", "footwork", "chat", "rest"],
};
const GROUP_SEEDS = 7919;
const PERIOD_SEEDS = 104729;
const CHAT_SEEDS = 15485863;
const SPEAKS_OFTEN = 0.7;

const roll = (...parts: number[]) => nextRandom(parts.reduce((seed, part) => Math.imul(seed ^ part, 16777619) | 0, 2166136261 | 0));

/** What a group is up to right now. A new roll every period, and the same seed always gives the same day. */
export function activityAt(seed: number, group: number, usual: CrowdActivity, tick: number): Activity {
  const period = Math.floor(tick / ACTIVITY_TICKS);
  const routine = ROUTINES[usual];
  return routine[Math.floor(roll(seed, group * GROUP_SEEDS, period * PERIOD_SEEDS).value * routine.length)];
}

/** Who's saying what in a group of this size right now, if anyone is. */
export function chatAt(seed: number, group: number, people: number, tick: number): { speaker: number; line: string } | null {
  const first = roll(seed, group * GROUP_SEEDS, Math.floor(tick / CHAT_TICKS) * CHAT_SEEDS);
  if (first.value >= SPEAKS_OFTEN) return null;
  const who = nextRandom(first.seed);
  const what = nextRandom(who.seed);
  return { speaker: Math.floor(who.value * people), line: CHAT_LINES[Math.floor(what.value * CHAT_LINES.length)] };
}

const groupOf = (member: CrowdMember) => (member.activity === "suburi" ? 0 : 1);

const footworkPose = (tick: number): CrowdPose => {
  const forward = tick % FOOTWORK_CYCLE < FOOTWORK_CYCLE / 2;
  return { held: "guard", dx: forward ? FOOTWORK_STEP : 0, frame: forward ? 1 : 0, shout: false };
};

/** How someone's standing right now. With no seed, they just do the thing they're there for. */
export function crowdPose(member: CrowdMember, tick: number, reducedMotion: boolean, seed?: number): CrowdPose {
  if (reducedMotion) return STILL;
  const activity = seed === undefined ? member.activity : activityAt(seed, groupOf(member), member.activity, tick);
  if (activity === "suburi") return suburiPose(tick, false);
  if (activity === "keiko") return keikoPose(tick, member.side, false);
  if (activity === "footwork") return footworkPose(tick);
  return STILL;
}

/** Everyone practicing in a room. Suburi groups face into the room, and each keiko pair faces each other. */
export function crowdIn(rows: string[]): CrowdMember[] {
  const middle = rows[0].length / 2;
  const group = findTiles(rows, "s").map(({ col, row }): CrowdMember => ({ col, row, activity: "suburi", flip: col >= middle, side: 0 }));
  const pair = findTiles(rows, "k").map(({ col, row }, i): CrowdMember => ({ col, row, activity: "keiko", flip: i % 2 === 1, side: (i % 2) as 0 | 1 }));
  return [...group, ...pair];
}

const SHOUT = "Men!";

/** How close you have to be, in pixels, to read someone's name. Their presence carries further. */
export const TAG_RANGE = 56;
export const rankTagShown = (you: { x: number; y: number }, them: { x: number; y: number }): boolean =>
  Math.hypot(you.x - them.x, you.y - them.y) <= TAG_RANGE;

/** Which of a row of people gets their tag shown: whoever's nearest, if anyone's close enough. */
export function nearestShown(you: { x: number; y: number }, row: { x: number; y: number }[]): number | null {
  let best: number | null = null;
  row.forEach((them, i) => {
    if (!rankTagShown(you, them)) return;
    if (best === null || Math.hypot(you.x - them.x, you.y - them.y) < Math.hypot(you.x - row[best].x, you.y - row[best].y)) best = i;
  });
  return best;
}

const BUBBLE_HEIGHT = 10;
/** How far below the spot it's given, in the world's pixels, a bubble's bottom edge goes: right over the head. */
const BUBBLE_BOTTOM = 7;

/** Something said out loud, over someone's head. It stays on screen, however near the edge they're standing. */
export function drawChatBubble(ctx: CanvasRenderingContext2D, line: string, centerX: number, y: number): void {
  const at = guiPoint(ctx, centerX, y + BUBBLE_BOTTOM);
  onGui(ctx, () => {
    const width = measureText(line);
    const left = Math.round(Math.max(4, Math.min(viewW - width - 4, at.x - width / 2)));
    const top = Math.round(at.y) - BUBBLE_HEIGHT;
    ctx.fillStyle = UI.keyFace;
    ctx.fillRect(left - 3, top, width + 6, BUBBLE_HEIGHT);
    drawText(ctx, line, left, top + 1, UI.panel);
  });
}

/** The people you can talk to chat among themselves, some of the time. */
export function drawNamedChat(ctx: CanvasRenderingContext2D, seed: number, group: number, tick: number, people: { x: number; y: number }[]): void {
  if (activityAt(seed, group, "keiko", tick) !== "chat" && activityAt(seed, group + 1, "keiko", tick) !== "chat") return;
  const chat = chatAt(seed, group, people.length, tick);
  if (chat) drawChatBubble(ctx, chat.line, people[chat.speaker].x, people[chat.speaker].y);
}

/** One drawing per person, so the scene can sort them in with everyone else. Anything they say goes on top, through `onTop`. */
export function crowdDrawings(
  ctx: CanvasRenderingContext2D, rows: string[], cam: Camera, tick: number, reducedMotion: boolean, colorsFor: (index: number) => Record<string, string>, seed?: number, onTop?: (draw: () => void) => void,
): { y: number; draw: () => void }[] {
  const crowd = crowdIn(rows);
  if (seed !== undefined && onTop && !reducedMotion) {
    for (const usual of ["suburi", "keiko"] as const) {
      const group = crowd.filter((member) => member.activity === usual);
      if (!group.length || activityAt(seed, groupOf(group[0]), usual, tick) !== "chat") continue;
      const chat = chatAt(seed, groupOf(group[0]), group.length, tick);
      if (chat) {
        const who = group[chat.speaker];
        onTop(() => drawChatBubble(ctx, chat.line, who.col * TILE - cam.x + 8, who.row * TILE - 12 - cam.y));
      }
    }
  }
  return crowd.map((member, i) => ({
    y: member.row * TILE,
    draw: () => {
      const pose = crowdPose(member, tick, reducedMotion, seed);
      const x = member.col * TILE - cam.x + (member.flip ? -pose.dx : pose.dx);
      const y = member.row * TILE - 4 - cam.y;
      drawKendoka(ctx, x, y, "side", pose.frame, FULL_GEAR, { flip: member.flip, colors: colorsFor(i), held: pose.held });
      if (pose.shout) drawLabelAt(ctx, SHOUT, x + 8, y - 2, UI.text);
    },
  }));
}
