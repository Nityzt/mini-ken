import { drawFighter, type DuelPose } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, measureText, wrapText } from "../art/font.ts";
import { FULL_GEAR, NO_GEAR, type Gear } from "../art/kendoka.ts";
import { RIVAL_COLORS, UI } from "../art/palette.ts";
import { playerColors } from "../characters.ts";
import { keyLabel } from "../core/key-labels.ts";
import { onGui, onStage, STAGE_W, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import {
  createDungeon, maxHp, pressReach, solidPlatforms, stepDungeon, trapPhase,
  CLIMB_TICKS, CRUMBLE_TICKS, DUNGEON_ROOMS, FINAL_ROOM, PLAYER_H, PLAYER_W, SCRAP_FOR_ARMOR,
  type DungeonEnemy, type DungeonPickup, type DungeonState, type PickupKind,
} from "../dungeon.ts";
import { abandonDungeon, captureDungeon, dungeonStage, finishDungeon, saveDungeonProgress } from "../dungeon-story.ts";
import { createDialogue } from "./dialogue.ts";
import { drawInteractPrompt } from "./ui.ts";

/**
 * Ren catching you in the lair is a scripted loss. Movement, strikes and guarding all work, and Ren's tells
 * are real, but whatever you do, Ren's smoke ends it.
 */
export type Ambush = {
  tick: number; x: number; renX: number; hp: number; hits: number; parries: number; swing: number; cooldown: number;
  ren: "close" | "tell" | "strike" | "recover"; renTicks: number;
  phase: "fight" | "smoke" | "captured";
};
export const AMBUSH_SMOKE_AT = 480;
export const AMBUSH_END = 600;
const AMBUSH_SMOKE_TICKS = AMBUSH_END - AMBUSH_SMOKE_AT;
export const createAmbush = (): Ambush => ({ tick: 0, x: 70, renX: 176, hp: 3, hits: 0, parries: 0, swing: 0, cooldown: 0, ren: "close", renTicks: 0, phase: "fight" });
export function stepAmbush(before: Ambush, input: { move: -1 | 0 | 1; attack: boolean; block: boolean }): Ambush {
  if (before.phase === "captured") return before;
  const state = { ...before, tick: before.tick + 1, swing: Math.max(0, before.swing - 1), cooldown: Math.max(0, before.cooldown - 1), renTicks: Math.max(0, before.renTicks - 1) };
  if (state.phase === "smoke") {
    if (state.renTicks === 0) {
      state.phase = "captured";
      state.hp = 0;
    }
    return state;
  }
  // You can circle, but not walk through Ren.
  const nextX = Math.max(24, Math.min(232, state.x + input.move * (input.block ? 0.5 : 1.3)));
  if (Math.abs(nextX - state.renX) >= 20 || Math.abs(nextX - state.renX) > Math.abs(state.x - state.renX)) state.x = nextX;
  const distance = Math.abs(state.renX - state.x);
  if (input.attack && !state.cooldown && !input.block) {
    state.swing = 12;
    state.cooldown = 24;
    if (distance < 38 && state.ren === "recover") state.hits++;
  }
  // Ren gets quicker as it goes on, but every strike is still raised first.
  if (state.ren === "close") {
    if (distance > 26) state.renX += Math.sign(state.x - state.renX) * 1.3;
    else if (!state.renTicks) {
      state.ren = "tell";
      state.renTicks = Math.max(14, 26 - Math.floor(state.tick / 40));
    }
  } else if (state.ren === "tell" && !state.renTicks) {
    state.ren = "strike";
    state.renTicks = 8;
    if (distance < 36) {
      // You always face Ren here, so a guard held in time always holds.
      if (input.block) state.parries++;
      else state.hp = Math.max(0, state.hp - 1);
    }
  } else if (state.ren === "strike" && !state.renTicks) {
    state.ren = "recover";
    state.renTicks = 26;
  } else if (state.ren === "recover" && !state.renTicks) {
    state.ren = "close";
    state.renTicks = 12;
  }
  if (state.tick >= AMBUSH_SMOKE_AT || state.hp === 0) {
    state.phase = "smoke";
    state.renTicks = AMBUSH_SMOKE_TICKS;
  }
  return state;
}

const NINJA_COLORS = { I: "#34374C", i: "#555A70", N: "#181D2B", S: "#4A4E63", s: "#34374C", P: "#4A4E63", H: "#181D2B", h: "#34374C", W: "#34374C", w: "#555A70", R: "#C8665A" };
const REN_COLORS = { ...NINJA_COLORS, R: "#BC3B56", H: "#211923", I: "#2A2232" };
const ROOM_COLORS = ["#2E3040", "#2B3A3F", "#3A3230", "#342B3A"];
const DARK = "#0B0D15";

const LAIR_LINES = [
  "A narrow stair, and at the bottom a room nobody was meant to find.",
  "Maps of every dojo in the city cover the wall. Pinecone is circled in red.",
  "Beside them hangs a black mask, and a Thunder Radish gi folded neatly beneath it.",
];
const CAUGHT_LINES = [
  "Ren: That door was closed for a reason.",
  "Ren: You've seen the maps. I can't let you walk out with that. Shinai up!",
];
const THROWN_LINES = [
  "Smoke. You can't see your own hands. Something strikes the back of your men.",
  "You wake on cold stone. Your shinai and every piece of your armor are gone.",
  "Somewhere above, a door bolts shut. You'll have to find your own way out.",
];
const REVEAL_LINES = [
  "Ren steps out of the shadows, masked in black, with a red scarf where a tare should be.",
  "Ren: Still going? You make a poor prisoner.",
  "Ren: Thunder Radish was a good place to hide. Every dojo in the city trusts its best student.",
  "Ren: Your things are in that chest. Come and take them.",
];
const REN_DOWN_LINES = [
  "Ren: Enough. You hit like you mean it.",
  "Ren: I watch dojos for people you'll never meet. This city was only one job.",
  "Ren: Keep my secret or don't. Nobody would believe the kid from Pinecone.",
];
const ESCAPE_LINES = [
  "Dressed again, you climb a service stair. It opens behind the Thunder Radish shrine.",
];
/** What the dojo looks like when you come back up. Ren is there, which is the point. */
export const RETURN_LINES = [
  "Back in the hall, Ren stands in the usual spot as if nothing happened, and doesn't look your way.",
  "Sensei Raiko doesn't seem to know. Not yet, anyway.",
];
const PICKUP_NOTICES: Record<PickupKind, string> = {
  shinai: "A practice shinai, split but whole enough. J strikes.",
  scrap: "Scrap plate",
  kote: "A guard's spare kote. Your wrists are covered.",
  rice: "A rice ball, still wrapped. You feel better.",
  crane: "A paper crane, folded small. Someone was here before you.",
  chest: "Your shinai and armor, every piece. You dress in a hurry.",
};
const PICKUP_LABELS: Record<PickupKind, string> = { shinai: "Take the shinai", scrap: "Take the scrap", kote: "Take the kote", rice: "Eat", crane: "Look closer", chest: "Open the chest" };

type Puff = { x: number; y: number; age: number };

/** Scene-local state is saved through the story helpers, never over the player's ordinary equipment. */
export function createDungeonScene(nameOf: () => string = () => "you"): Scene {
  const dialogue = createDialogue(nameOf);
  let ambush = createAmbush();
  let state: DungeonState = createDungeon();
  let mode: "lair" | "ambush" | "trial" | "escape" = "lair";
  let lairX = 20;
  let renDrop = 0;
  let notice = "";
  let noticeTicks = 0;
  let camera = 0;
  let wake = 0;
  let tick = 0;
  let renGone = false;
  let taught = new Set<string>();
  let puffs: Puff[] = [];
  /** When each guard went down, so it can fall and fade rather than vanish. */
  let downAt: Record<string, number> = {};

  const say = (text: string, ticks = 180) => {
    notice = text;
    noticeTicks = ticks;
  };
  const puff = (x: number, y: number, count = 6) => {
    for (let i = 0; i < count; i++) puffs.push({ x: x + ((i * 7) % 13) - 6, y: y - ((i * 5) % 11), age: -i * 2 });
  };
  const publish = (game: Game) => {
    game.debug.dungeon = { mode, ambush, state, notice, dialogue: dialogue.active, lairX };
  };
  const enterRoom = (game: Game) => {
    camera = cameraFor(state, state.player.x);
    downAt = {};
    puffs = [];
    const room = DUNGEON_ROOMS[state.room];
    if (room.hint) say(room.hint, 240);
    if (state.room === FINAL_ROOM && !state.recovered) {
      renGone = false;
      dialogue.open(REVEAL_LINES);
    }
    publish(game);
  };
  const beginTrial = (game: Game) => {
    mode = "trial";
    game.run = captureDungeon(game.run);
    state = createDungeon();
    game.run = saveDungeonProgress(game.run, state);
    wake = 60;
    enterRoom(game);
  };
  const beginAmbush = () => {
    mode = "ambush";
    ambush = createAmbush();
    ambush.x = lairX;
  };

  return {
    busy: () => dialogue.active || mode !== "trial",
    forfeitLabel: () => "Leave the trial and recover your gear",
    forfeit(game) {
      game.run = abandonDungeon(game.run);
      game.message = ["You find a service ladder and recover your equipment. The hidden stair will still be there when you're ready."];
      game.go("rival-dojo");
    },
    enter(game) {
      ambush = createAmbush();
      taught = new Set();
      lairX = 20;
      renDrop = 0;
      wake = 0;
      noticeTicks = 0;
      mode = dungeonStage(game.run) === "active" ? "trial" : "lair";
      if (mode === "trial") {
        state = game.run.dungeon.progress ?? createDungeon();
        game.run = saveDungeonProgress(game.run, state);
        renGone = state.recovered;
        enterRoom(game);
      }
      publish(game);
    },
    update(game) {
      tick++;
      if (noticeTicks > 0) noticeTicks--;
      if (wake > 0) wake--;
      puffs = puffs.map((p) => ({ ...p, age: p.age + 1, y: p.y - 0.15 })).filter((p) => p.age < 40);
      if (dialogue.active) {
        dialogue.update(game.input, game.audio);
        publish(game);
        return;
      }
      const move = game.input.isDown("left") ? -1 : game.input.isDown("right") ? 1 : 0;
      const attack = game.input.wasPressed("men") || game.input.wasPressed("kote") || game.input.wasPressed("do");
      if (mode === "lair") updateLair(game, move);
      else if (mode === "ambush") {
        const next = stepAmbush(ambush, { move, attack, block: game.input.isDown("down") });
        if (next.hits > ambush.hits) game.audio.play("clean");
        if (next.parries > ambush.parries) game.audio.play("parry");
        if (next.hp < ambush.hp) game.audio.play("break");
        if (next.swing > ambush.swing) game.audio.play("swing");
        if (next.phase === "smoke" && ambush.phase !== "smoke") {
          game.audio.play("charge");
          puff(next.renX, 100, 12);
        }
        if (next.phase === "smoke" && next.tick % 6 === 0) puff(next.x + ((next.tick * 13) % 60) - 30, 104, 2);
        ambush = next;
        if (ambush.phase === "captured") dialogue.open(THROWN_LINES, () => beginTrial(game), () => beginTrial(game));
      } else if (mode === "trial") updateTrial(game, move, attack);
      publish(game);
    },
    render(ctx, game) {
      ctx.fillStyle = DARK;
      ctx.fillRect(0, 0, viewW, viewH);
      onStage(ctx, () => {
        if (mode === "lair" || mode === "ambush") drawLair(ctx, game, mode === "lair" ? null : ambush, lairX, renDrop, tick, puffs);
        else drawDungeonRoom(ctx, game, state, camera, tick, downAt, renGone, puffs);
        if (wake > 0) {
          ctx.globalAlpha = Math.min(1, wake / 40);
          ctx.fillStyle = DARK;
          ctx.fillRect(0, 0, STAGE_W, 144);
          ctx.globalAlpha = 1;
        }
        if (mode === "trial" && state.phase === "playing" && !dialogue.active) drawPrompt(ctx, game, state, camera);
      });
      onGui(ctx, () => {
        drawHud(ctx, game, mode, state, ambush, dialogue.active);
        if (noticeTicks > 0 && !dialogue.active) {
          const lines = wrapText(notice, viewW - 16).slice(0, 2);
          const width = Math.max(...lines.map((line) => measureText(line))) + 8;
          ctx.globalAlpha = Math.min(1, noticeTicks / 20);
          ctx.fillStyle = UI.panel;
          ctx.fillRect(Math.floor(viewW / 2 - width / 2), 26, width, lines.length * 10 + 3);
          lines.forEach((line, i) => drawTextCentered(ctx, line, viewW / 2, 28 + i * 10, UI.accent));
          ctx.globalAlpha = 1;
        }
        if (mode === "trial" && state.phase === "dead") drawRetry(ctx, game, state);
        dialogue.render(ctx);
      });
    },
  };

  function updateLair(game: Game, move: -1 | 0 | 1): void {
    if (renDrop) {
      // Ren comes down from the beam before anything is said.
      if (++renDrop >= 24) {
        dialogue.open(CAUGHT_LINES, () => beginAmbush(), () => beginAmbush());
        renDrop = 24;
      }
      return;
    }
    lairX = Math.max(16, Math.min(150, lairX + move * 1.1));
    const atWall = lairX >= 96;
    if ((atWall && game.input.wasPressed("confirm")) || lairX >= 150) {
      game.audio.play("secret");
      dialogue.open(LAIR_LINES, () => {
        renDrop = 1;
      }, () => {
        renDrop = 1;
      });
    }
  }

  function updateTrial(game: Game, move: -1 | 0 | 1, attack: boolean): void {
    const before = state;
    const interact = game.input.wasPressed("confirm");
    state = stepDungeon(state, {
      move,
      jump: !interact && game.input.wasPressed("up"),
      up: game.input.isDown("up"),
      attack: !interact && attack,
      interact,
      block: game.input.isDown("down"),
      retry: interact,
    });
    const room = DUNGEON_ROOMS[state.room];
    for (const event of state.events) {
      if (event.type === "swing") game.audio.play("swing");
      if (event.type === "hurt") game.audio.play("break");
      if (event.type === "hit") game.audio.play("clean");
      if (event.type === "blocked") {
        game.audio.play("blocked");
        if (!taught.has("blocked")) say("Blocked. A guard facing you is ready: guard its strike, then answer.", 200);
        taught.add("blocked");
      }
      if (event.type === "parry") {
        game.audio.play("parry");
        say("Turned aside! Strike now, while it recovers.", 90);
      }
      if (event.type === "deflect") game.audio.play("clash");
      if (event.type === "grab") game.audio.play("ting");
      if (event.type === "crumble") game.audio.play("dud");
      if (event.type === "throw") game.audio.play("swing");
      if (event.type === "vanish" || event.type === "appear") {
        game.audio.play("charge");
        const ren = state.enemies.find((enemy) => enemy.id === event.id);
        if (ren) puff(ren.x + PLAYER_W / 2, ren.y + PLAYER_H, 8);
        if (event.type === "vanish") puff(before.enemies.find((enemy) => enemy.id === event.id)!.x + PLAYER_W / 2, ren!.y + PLAYER_H, 8);
      }
      if (event.type === "pickup" || event.type === "secret") {
        game.audio.play(event.type === "secret" ? "secret" : "pickup");
        const kind = room.pickups.find((pickup) => pickup.id === event.id)!.kind;
        say(kind === "scrap" ? `Scrap plate: ${state.materials} of ${SCRAP_FOR_ARMOR}. A workbench could make armor of it.` : PICKUP_NOTICES[kind]);
      }
      if (event.type === "craft") {
        game.audio.play("bell");
        say("You lash the scrap into a do and tare. You can take more hits now.");
      }
      if (event.type === "gear") {
        game.audio.play("flag");
        say(PICKUP_NOTICES.chest);
      }
      if (event.type === "locked" && event.text) say(event.text, 200);
      if (event.type === "death") game.audio.play("dud");
      if (event.type === "ren-down") {
        game.audio.play("bell");
        dialogue.open(REN_DOWN_LINES, () => vanishRen(), () => vanishRen());
      }
    }
    for (const enemy of state.enemies) {
      if (enemy.hp === 0 && downAt[enemy.id] === undefined) downAt[enemy.id] = state.tick;
      if (enemy.state === "alert" && !taught.has("alert") && state.room < 2) {
        taught.add("alert");
        say("It's seen you. Hold S to guard when it raises its blade, then strike.", 220);
      }
    }
    if (state.room !== before.room || state.events.some((event) => event.type === "retry")) enterRoom(game);
    const target = cameraFor(state, state.player.x);
    camera += (target - camera) * 0.12;
    if (Math.abs(target - camera) < 0.2) camera = target;
    game.run = saveDungeonProgress(game.run, state);
    if (state.phase === "escaped") {
      mode = "escape";
      const leave = () => {
        game.run = finishDungeon(game.run);
        game.message = [...RETURN_LINES];
        game.go("rival-dojo");
      };
      dialogue.open(ESCAPE_LINES, leave, leave);
    }
  }

  function vanishRen(): void {
    const ren = state.enemies.find((enemy) => enemy.kind === "ren");
    if (ren) puff(ren.x + PLAYER_W / 2, ren.y + PLAYER_H, 12);
    renGone = true;
    say("Ren is gone in a puff of smoke. The chest is unlocked.", 200);
  }
}

const cameraFor = (state: DungeonState, x: number): number => Math.max(0, Math.min(DUNGEON_ROOMS[state.room].width - STAGE_W, x + PLAYER_W / 2 - STAGE_W / 2));

/** Light thrown by a flame: rings that fade outward, rather than a lit box. */
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number): void {
  ctx.fillStyle = color;
  for (const size of [36, 26, 16]) {
    ctx.globalAlpha = alpha;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.fillRect(x - size / 2 - 3, y - size / 2 + 3, size + 6, size - 6);
  }
  ctx.globalAlpha = 1;
}

function drawPuffs(ctx: CanvasRenderingContext2D, puffs: Puff[]): void {
  for (const p of puffs) {
    if (p.age < 0) continue;
    const size = 3 + Math.floor(p.age / 5);
    ctx.globalAlpha = Math.max(0, 0.85 - p.age / 45);
    ctx.fillStyle = "#B9BCC4";
    ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
    ctx.fillStyle = "#8E929C";
    ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y + size / 2 - 1), size, 1);
  }
  ctx.globalAlpha = 1;
}

/** The lair: the room under the stair, where Ren keeps what a spy keeps. */
function drawLair(ctx: CanvasRenderingContext2D, game: Game, fight: Ambush | null, lairX: number, renDrop: number, tick: number, puffs: Puff[]): void {
  ctx.fillStyle = "#2A2530";
  ctx.fillRect(0, 13, STAGE_W, 118);
  for (let y = 18; y < 113; y += 12) for (let x = ((y / 12) % 2) * 12; x < STAGE_W - 23; x += 24) {
    ctx.fillStyle = "#231F29";
    ctx.fillRect(x, y, 23, 1);
    ctx.fillRect(x, y, 1, 12);
  }
  // The stair you came down.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? "#4A3F3A" : "#55483F";
    ctx.fillRect(0, 40 + i * 12, 14 + i * 3, 12);
  }
  // A beam to drop from.
  ctx.fillStyle = "#4E3B2B";
  ctx.fillRect(0, 24, STAGE_W, 5);
  ctx.fillStyle = "#6B523B";
  ctx.fillRect(0, 24, STAGE_W, 1);
  // The map wall: every dojo pinned up, Pinecone circled.
  ctx.fillStyle = "#C9B98F";
  ctx.fillRect(92, 38, 84, 44);
  ctx.fillStyle = "#A99A72";
  for (let i = 0; i < 4; i++) ctx.fillRect(96 + i * 20, 42, 16, 36);
  ctx.fillStyle = "#7C8E6A";
  ctx.fillRect(98, 52, 8, 5);
  ctx.fillRect(140, 60, 10, 6);
  ctx.fillStyle = "#6E7F95";
  ctx.fillRect(118, 46, 9, 4);
  ctx.fillStyle = "#B8323A";
  for (const [x, y] of [[100, 47], [121, 66], [143, 50], [160, 70]]) ctx.fillRect(x, y, 2, 2);
  ctx.strokeStyle = "#C8303A";
  ctx.lineWidth = 1;
  ctx.strokeRect(97.5, 50.5, 11, 9);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = "#3B2D27";
    ctx.fillRect(103 + i * 20, 39, 2, 2);
  }
  // The mask on its peg, with the gi beneath.
  ctx.fillStyle = "#16141C";
  ctx.fillRect(194, 44, 12, 10);
  ctx.fillStyle = "#BC3B56";
  ctx.fillRect(194, 48, 12, 2);
  ctx.fillStyle = "#E9E4DA";
  ctx.fillRect(197, 49, 2, 1);
  ctx.fillRect(201, 49, 2, 1);
  ctx.fillStyle = "#7C2A33";
  ctx.fillRect(190, 72, 20, 8);
  ctx.fillStyle = "#9A3A43";
  ctx.fillRect(190, 72, 20, 2);
  // A desk with a candle.
  ctx.fillStyle = "#5A4332";
  ctx.fillRect(110, 92, 50, 4);
  ctx.fillRect(113, 96, 3, 17);
  ctx.fillRect(154, 96, 3, 17);
  ctx.fillStyle = "#E7DDC2";
  ctx.fillRect(122, 89, 14, 3);
  ctx.fillStyle = "#EFE2B5";
  ctx.fillRect(146, 85, 3, 7);
  const flame = game.reducedMotion ? 0 : (tick >> 3) % 2;
  ctx.fillStyle = "#F2B05A";
  ctx.fillRect(146, 82 - flame, 3, 3 + flame);
  glow(ctx, 147, 84, "#F2B05A", 0.07);
  // The floor.
  ctx.fillStyle = "#4C4038";
  ctx.fillRect(0, 113, STAGE_W, 18);
  ctx.fillStyle = "#62544A";
  ctx.fillRect(0, 113, STAGE_W, 2);
  const colors = playerColors(game.run);
  const gear = game.run.gear;
  const weapon = gear.shinai ? "shinai" : "none";
  if (!fight) {
    const moving = game.input.isDown("left") || game.input.isDown("right");
    drawFighter(ctx, lairX, 113, "guard", "player", moving ? (tick >> 3) % 3 : 0, gear, { colors, flip: game.input.isDown("left"), insignia: game.run.insignia, weapon });
    if (renDrop) {
      const y = Math.min(113, 29 + (renDrop * renDrop) / 6.8);
      drawFighter(ctx, 176, y, renDrop < 24 ? "launch" : "guard", "rival", 0, FULL_GEAR, { colors: RIVAL_COLORS, flip: true });
    }
    drawPuffs(ctx, puffs);
    return;
  }
  const smoking = fight.phase !== "fight";
  const playerPose: DuelPose = fight.phase === "captured" || (smoking && fight.renTicks < 50) ? "stunned" : fight.swing ? "strikeMen" : game.input.isDown("down") ? "block" : "guard";
  const renPose: DuelPose = smoking ? "zanshin" : fight.ren === "tell" ? "tellBigRaise" : fight.ren === "strike" ? "strikeMen" : fight.ren === "recover" ? "recover" : "guard";
  const moving = game.input.isDown("left") || game.input.isDown("right");
  drawFighter(ctx, fight.x, 113, playerPose, "player", moving ? (fight.tick >> 3) % 3 : 0, gear, { colors, flip: fight.x > fight.renX, insignia: game.run.insignia, weapon });
  if (!smoking || fight.renTicks > AMBUSH_SMOKE_TICKS - 30) drawFighter(ctx, fight.renX, 113, renPose, "rival", 0, FULL_GEAR, { colors: RIVAL_COLORS, flip: fight.renX > fight.x });
  if (fight.ren === "tell" && !smoking) {
    ctx.fillStyle = UI.bad;
    ctx.fillRect(Math.round(fight.renX) - 1, 62, 2, 6);
    ctx.fillRect(Math.round(fight.renX) - 1, 70, 2, 2);
  }
  drawPuffs(ctx, puffs);
  if (smoking) {
    const through = 1 - fight.renTicks / AMBUSH_SMOKE_TICKS;
    ctx.globalAlpha = Math.min(0.92, through * 1.1);
    ctx.fillStyle = "#9EA2AC";
    ctx.fillRect(0, 13, STAGE_W, 118);
    ctx.globalAlpha = 1;
  }
}

function drawRoomBackdrop(ctx: CanvasRenderingContext2D, game: Game, state: DungeonState, tick: number): void {
  const room = DUNGEON_ROOMS[state.room];
  ctx.fillStyle = ROOM_COLORS[state.room];
  ctx.fillRect(0, 13, room.width, 118);
  for (let y = 16; y < 120; y += 12) for (let x = ((y / 12) % 2) * 14; x < room.width; x += 28) {
    ctx.fillStyle = "#00000022";
    ctx.fillRect(x, y, 27, 1);
    ctx.fillRect(x, y, 1, 12);
  }
  // Something of each room's own.
  if (state.room === 0) {
    for (let x = 0; x < 40; x += 6) {
      ctx.fillStyle = "#6E726F";
      ctx.fillRect(x + 2, 40, 2, 80);
    }
    ctx.fillStyle = "#6E726F";
    ctx.fillRect(0, 40, 40, 2);
    ctx.fillRect(30, 60, 6, 2);
  }
  if (state.room === 1) {
    for (let x = 60; x < room.width; x += 120) {
      ctx.fillStyle = "#5B3438";
      ctx.fillRect(x, 26, 14, 30);
      ctx.fillStyle = "#3D2629";
      ctx.fillRect(x, 50, 14, 6);
      ctx.fillStyle = "#C9A66B";
      ctx.fillRect(x + 5, 32, 4, 4);
    }
  }
  if (state.room === 2) {
    ctx.fillStyle = "#6B5A3F";
    ctx.fillRect(0, 18, room.width, 4);
    for (let x = 30; x < room.width; x += 90) {
      ctx.fillStyle = "#7B6A4B";
      ctx.fillRect(x, 22, 4, 40);
      const turn = game.reducedMotion ? 0 : (tick >> 4) % 2;
      ctx.fillStyle = "#8D6E3F";
      ctx.fillRect(x + 20, 34 + turn, 12, 12 - turn * 2);
      ctx.fillStyle = "#5A4630";
      ctx.fillRect(x + 24, 38, 4, 4);
    }
    // A furnace behind the bench, which is what the scrap gets worked in.
    ctx.fillStyle = "#4A3A33";
    ctx.fillRect(504, 84, 30, 36);
    ctx.fillRect(510, 40, 18, 44);
    ctx.fillStyle = "#2A1E1A";
    ctx.fillRect(510, 98, 18, 22);
    ctx.fillRect(512, 96, 14, 2);
    const fire = game.reducedMotion ? 0 : (tick >> 3) % 3;
    ctx.fillStyle = "#E58A3C";
    ctx.fillRect(512, 108 - fire, 14, 12 + fire);
    ctx.fillStyle = "#F6C76A";
    ctx.fillRect(515, 112 - fire, 8, 8 + fire);
    glow(ctx, 519, 110, "#E58A3C", 0.06);
  }
  if (state.room === FINAL_ROOM) {
    ctx.fillStyle = "#C9B98F";
    for (const x of [96, 150]) ctx.fillRect(x, 36, 34, 26);
    ctx.fillStyle = "#B8323A";
    for (const [x, y] of [[104, 44], [120, 54], [158, 42], [170, 56]]) ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = "#7C2A33";
    ctx.fillRect(40, 20, 10, 40);
    ctx.fillRect(238, 20, 10, 40);
  }
  // Torches, lighting the way.
  for (let x = 80; x < room.width; x += 160) {
    ctx.fillStyle = "#4A3A2A";
    ctx.fillRect(x, 70, 3, 8);
    const flicker = game.reducedMotion ? 0 : (tick >> 2) % 3;
    ctx.fillStyle = "#F2B05A";
    ctx.fillRect(x - 1, 65 - (flicker === 1 ? 1 : 0), 5, 5);
    ctx.fillStyle = "#FBE7A1";
    ctx.fillRect(x, 67, 3, 2);
    glow(ctx, x + 1, 67, "#F2B05A", 0.05);
  }
  // Pits fall away into the dark.
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 120, room.width, 11);
}

function drawPlatforms(ctx: CanvasRenderingContext2D, state: DungeonState): void {
  const room = DUNGEON_ROOMS[state.room];
  const standing = solidPlatforms(state);
  for (const platform of room.platforms) {
    const crumble = platform.id ? state.crumble[platform.id] ?? 0 : 0;
    const fallen = !standing.includes(platform);
    if (fallen && crumble > CRUMBLE_TICKS + 24) continue;
    const drop = fallen ? ((crumble - CRUMBLE_TICKS) ** 2) * 0.15 : 0;
    const shake = crumble && !fallen ? (crumble % 4 < 2 ? 1 : -1) : 0;
    const x = platform.x + shake;
    const y = platform.y + drop;
    if (platform.h <= 8) {
      // Wooden beams and catwalks.
      ctx.fillStyle = "#5C4330";
      ctx.fillRect(x, y, platform.w, platform.h);
      ctx.fillStyle = "#8F6C49";
      ctx.fillRect(x, y, platform.w, 2);
      ctx.fillStyle = "#3E2D21";
      for (let i = x + 3; i < x + platform.w - 2; i += 10) ctx.fillRect(i, y + 2, 1, platform.h - 2);
      ctx.fillRect(x + 2, y + platform.h, 2, 4);
      ctx.fillRect(x + platform.w - 4, y + platform.h, 2, 4);
      continue;
    }
    ctx.fillStyle = "#1E2330";
    ctx.fillRect(x, y, platform.w, platform.h);
    ctx.fillStyle = "#2A3040";
    for (let row = 0; row * 8 < platform.h - 4; row++) {
      for (let i = (row % 2) * 8; i < platform.w - 2; i += 16) ctx.fillRect(x + i + 1, y + 4 + row * 8, Math.min(14, platform.w - i - 2), 6);
    }
    ctx.fillStyle = "#8A8F86";
    ctx.fillRect(x, y, platform.w, 2);
    ctx.fillStyle = "#59615F";
    ctx.fillRect(x, y + 2, platform.w, 1);
    if (platform.loose) {
      // Cracks give the slab away to anyone looking.
      ctx.fillStyle = "#11151F";
      ctx.fillRect(x + 8, y, 1, 5);
      ctx.fillRect(x + 9, y + 4, 4, 1);
      ctx.fillRect(x + 24, y + 1, 1, 6);
      ctx.fillRect(x + 20, y + 6, 4, 1);
    }
    if (crumble && !fallen && crumble % 6 < 3) {
      ctx.fillStyle = "#8A8F86";
      ctx.fillRect(x + 4 + (crumble % 7) * 4, y + platform.h + (crumble % 5), 1, 1);
    }
  }
}

function drawTraps(ctx: CanvasRenderingContext2D, game: Game, state: DungeonState): void {
  for (const trap of DUNGEON_ROOMS[state.room].traps) {
    const phase = trapPhase(trap, state.tick);
    if (trap.kind === "spikes") {
      ctx.fillStyle = "#3A3E46";
      ctx.fillRect(trap.x, trap.y + trap.h - 1, trap.w, 1);
      for (let x = trap.x + 1; x < trap.x + trap.w; x += 5) {
        ctx.fillStyle = "#151820";
        ctx.fillRect(x, trap.y + trap.h - 1, 2, 1);
        const jitter = phase === "warn" && !game.reducedMotion && (state.tick >> 2) % 2 ? 1 : 0;
        if (phase === "warn") {
          ctx.fillStyle = "#C9CDD2";
          ctx.fillRect(x + jitter, trap.y + trap.h - 3, 1, 2);
        }
        if (phase === "active") {
          ctx.fillStyle = "#C9CDD2";
          ctx.fillRect(x, trap.y + 2, 2, trap.h - 2);
          ctx.fillStyle = "#F3F5F7";
          ctx.fillRect(x, trap.y, 1, 3);
        }
      }
    }
    if (trap.kind === "press") {
      const reach = pressReach(trap, state.tick);
      const shake = phase === "warn" && !game.reducedMotion ? ((state.tick >> 1) % 2 ? 1 : -1) : 0;
      ctx.fillStyle = "#4E4A46";
      ctx.fillRect(trap.x + trap.w / 2 - 1, trap.y, 2, reach - 14);
      ctx.fillStyle = "#5F5A55";
      ctx.fillRect(trap.x + shake, trap.y + reach - 14, trap.w, 14);
      ctx.fillStyle = "#837C74";
      ctx.fillRect(trap.x + shake, trap.y + reach - 14, trap.w, 2);
      ctx.fillStyle = "#3A3632";
      ctx.fillRect(trap.x + 3 + shake, trap.y + reach - 9, 2, 2);
      ctx.fillRect(trap.x + trap.w - 5 + shake, trap.y + reach - 9, 2, 2);
      if (phase === "warn") {
        // Dust falls where it will land, and a shadow grows on the floor.
        ctx.fillStyle = "#A39C8E";
        for (let i = 0; i < 3; i++) ctx.fillRect(trap.x + 3 + i * 7, trap.y + reach + ((state.tick + i * 9) % 30) * 3, 1, 1);
        ctx.globalAlpha = 0.25 + (state.tick % trap.period) / trap.warn / 3;
        ctx.fillStyle = "#000";
        ctx.fillRect(trap.x - 2, trap.y + trap.h - 2, trap.w + 4, 2);
        ctx.globalAlpha = 1;
      }
    }
    if (trap.kind === "darts") {
      const glow = phase === "warn" ? (state.tick % 8 < 4 ? "#F06A4A" : "#B8442E") : "#2A1E1C";
      ctx.fillStyle = "#3A3E46";
      ctx.fillRect(trap.x - 1, trap.y - 2, 4, 7);
      ctx.fillStyle = glow;
      ctx.fillRect(trap.x, trap.y, 2, 3);
    }
  }
  for (const shot of state.projectiles) {
    if (shot.kind === "dart") {
      ctx.fillStyle = "#C9CDD2";
      ctx.fillRect(Math.round(shot.x) - 3, Math.round(shot.y) + 1, 6, 1);
      ctx.fillStyle = "#B8442E";
      ctx.fillRect(Math.round(shot.x) + (shot.vx < 0 ? 2 : -3), Math.round(shot.y), 2, 3);
    } else {
      const spin = (state.tick >> 1) % 2;
      ctx.fillStyle = "#DADDE3";
      if (spin) {
        ctx.fillRect(Math.round(shot.x) - 2, Math.round(shot.y), 5, 1);
        ctx.fillRect(Math.round(shot.x), Math.round(shot.y) - 2, 1, 5);
      } else {
        ctx.fillRect(Math.round(shot.x) - 1, Math.round(shot.y) - 1, 1, 1);
        ctx.fillRect(Math.round(shot.x) + 1, Math.round(shot.y) - 1, 1, 1);
        ctx.fillRect(Math.round(shot.x) - 1, Math.round(shot.y) + 1, 1, 1);
        ctx.fillRect(Math.round(shot.x) + 1, Math.round(shot.y) + 1, 1, 1);
        ctx.fillRect(Math.round(shot.x), Math.round(shot.y), 1, 1);
      }
    }
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, game: Game, pickup: DungeonPickup, tick: number, open: boolean): void {
  const bob = game.reducedMotion || pickup.kind === "chest" || pickup.kind === "kote" ? 0 : Math.round(Math.sin(tick / 14));
  const x = pickup.x;
  const floor = pickup.y + PLAYER_H;
  const y = floor + bob;
  if (pickup.kind === "shinai") {
    ctx.fillStyle = "#D4B574";
    ctx.fillRect(x - 6, y - 3, 17, 2);
    ctx.fillStyle = "#E9E4DA";
    ctx.fillRect(x - 8, y - 3, 3, 2);
    ctx.fillStyle = "#5E4A2E";
    ctx.fillRect(x + 5, y - 4, 1, 4);
  } else if (pickup.kind === "scrap") {
    ctx.fillStyle = "#7F9C96";
    ctx.fillRect(x, y - 6, 8, 5);
    ctx.fillStyle = "#B7CEC7";
    ctx.fillRect(x + 1, y - 5, 3, 2);
    ctx.fillStyle = "#4F625E";
    ctx.fillRect(x, y - 1, 8, 1);
  } else if (pickup.kind === "kote") {
    // An open locker, with the kote hanging in it.
    ctx.fillStyle = "#3D4A55";
    ctx.fillRect(x - 3, floor - 20, 14, 20);
    ctx.fillStyle = "#1C232B";
    ctx.fillRect(x - 1, floor - 18, 10, 16);
    if (!open) {
      ctx.fillStyle = "#2F4A7A";
      ctx.fillRect(x + 1, floor - 13 + bob, 6, 6);
      ctx.fillStyle = "#E9E4DA";
      ctx.fillRect(x + 1, floor - 13 + bob, 6, 1);
    }
  } else if (pickup.kind === "rice") {
    ctx.fillStyle = "#F1ECE0";
    ctx.fillRect(x, y - 5, 7, 5);
    ctx.fillRect(x + 1, y - 6, 5, 1);
    ctx.fillStyle = "#2E3A2C";
    ctx.fillRect(x + 1, y - 3, 5, 3);
  } else if (pickup.kind === "crane") {
    ctx.fillStyle = "#E7D892";
    ctx.fillRect(x, y - 3, 7, 2);
    ctx.fillRect(x + 2, y - 5, 2, 3);
    ctx.fillRect(x + 5, y - 6, 1, 3);
  } else if (pickup.kind === "chest") {
    ctx.fillStyle = "#6A4A2E";
    ctx.fillRect(x - 3, floor - 10, 16, 10);
    ctx.fillStyle = open ? "#2A1E14" : "#8A6440";
    ctx.fillRect(x - 3, floor - (open ? 14 : 12), 16, open ? 4 : 3);
    ctx.fillStyle = "#D9B65A";
    ctx.fillRect(x + 4, floor - 8, 2, 3);
  }
  // A glint, so nothing worth taking hides in the dark.
  if (!open && !game.reducedMotion && (tick + x) % 90 < 6) {
    ctx.fillStyle = "#FFF6D0";
    ctx.fillRect(x + 3, floor - (pickup.kind === "kote" ? 15 : 9), 1, 1);
  }
}

function drawDungeonRoom(ctx: CanvasRenderingContext2D, game: Game, state: DungeonState, camera: number, tick: number, downAt: Record<string, number>, renGone: boolean, puffs: Puff[]): void {
  const room = DUNGEON_ROOMS[state.room];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 13, STAGE_W, 118);
  ctx.clip();
  ctx.translate(-Math.round(camera), 0);
  drawRoomBackdrop(ctx, game, state, tick);
  const exit = { x: room.exit.x, y: room.exit.y + PLAYER_H };
  const unlocked = state.enemies.every((enemy) => enemy.hp === 0);
  ctx.fillStyle = "#11141E";
  ctx.fillRect(exit.x - 7, exit.y - 28, 20, 28);
  ctx.fillStyle = unlocked ? "#B1B69B" : "#6E7262";
  ctx.fillRect(exit.x - 8, exit.y - 30, 22, 3);
  if (!unlocked) {
    // Barred until the guards are down.
    ctx.fillStyle = "#6E726F";
    for (let i = 0; i < 4; i++) ctx.fillRect(exit.x - 5 + i * 5, exit.y - 27, 1, 27);
  } else if (state.room !== FINAL_ROOM) {
    ctx.fillStyle = "#E8C872";
    ctx.fillRect(exit.x + 2, exit.y - 20 + ((tick >> 4) % 2), 2, 4);
  }
  drawPlatforms(ctx, state);
  if (room.bench) {
    const { x } = room.bench;
    const y = room.bench.y + PLAYER_H;
    ctx.fillStyle = "#8F7550";
    ctx.fillRect(x - 12, y - 9, 26, 3);
    ctx.fillStyle = "#6B5639";
    ctx.fillRect(x - 10, y - 6, 3, 6);
    ctx.fillRect(x + 9, y - 6, 3, 6);
    ctx.fillStyle = "#4A4E55";
    ctx.fillRect(x - 6, y - 12, 6, 3);
    ctx.fillStyle = "#9AA0A6";
    ctx.fillRect(x + 3, y - 11, 6, 1);
  }
  for (const pickup of room.pickups) {
    const taken = state.collected.includes(pickup.id);
    if (taken && pickup.kind !== "chest" && pickup.kind !== "kote") continue;
    drawPickup(ctx, game, pickup, tick, taken);
  }
  drawTraps(ctx, game, state);
  for (const enemy of state.enemies) drawEnemy(ctx, game, state, enemy, downAt[enemy.id], renGone);
  drawPlayer(ctx, game, state);
  drawPuffs(ctx, puffs);
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, game: Game, state: DungeonState, enemy: DungeonEnemy, downAt: number | undefined, renGone: boolean): void {
  if (enemy.state === "vanish" && enemy.ticks > 20) return;
  const ren = enemy.kind === "ren";
  if (enemy.state === "down") {
    if (ren && renGone) return;
    const since = state.tick - (downAt ?? state.tick);
    if (!ren && since > 45) return;
    ctx.globalAlpha = ren ? 1 : Math.max(0, 1 - since / 45);
    drawSmallFighter(ctx, enemy.x + PLAYER_W / 2, enemy.y + PLAYER_H, ren ? "sonkyo" : "stunned", 0, { ...NO_GEAR, shinai: true }, ren ? REN_COLORS : NINJA_COLORS, enemy.facing === -1);
    ctx.globalAlpha = 1;
    return;
  }
  if (enemy.state === "vanish") ctx.globalAlpha = (20 - enemy.ticks) / 20;
  const pose: DuelPose = enemy.state === "tell" ? "tellBigRaise" : enemy.state === "strike" ? "strikeMen" : enemy.state === "recover" ? "recover" : enemy.state === "block" ? "block" : enemy.state === "aim" ? "tellHandsUp" : "guard";
  const walking = enemy.state === "patrol" || enemy.state === "chase";
  if (!(enemy.flash && enemy.flash % 4 < 2)) drawSmallFighter(ctx, enemy.x + PLAYER_W / 2, enemy.y + PLAYER_H, pose, walking ? (state.tick >> 3) % 3 : 0, { ...NO_GEAR, shinai: enemy.kind !== "thrower" }, ren ? REN_COLORS : NINJA_COLORS, enemy.facing === -1);
  ctx.globalAlpha = 1;
  const head = { x: Math.round(enemy.x + PLAYER_W / 2), y: enemy.y - 3 };
  if (enemy.state === "alert" || enemy.state === "tell" || enemy.state === "aim") {
    // Every attack is shown first: a red mark over the head, blinking faster as it comes.
    const fast = enemy.state !== "alert" && enemy.ticks < 10;
    if (enemy.state === "alert" || game.reducedMotion || (state.tick >> (fast ? 1 : 2)) % 2) {
      ctx.fillStyle = enemy.state === "alert" ? UI.accent : UI.bad;
      ctx.fillRect(head.x - 1, head.y - 8, 2, 4);
      ctx.fillRect(head.x - 1, head.y - 3, 2, 1);
    }
  }
  if (enemy.state === "aim") {
    ctx.fillStyle = "#FFF6D0";
    ctx.fillRect(Math.round(enemy.x) + (enemy.facing === 1 ? 9 : 0), enemy.y + 3, 1, 1);
  }
  if (enemy.state === "block") {
    ctx.fillStyle = "#FFF6D0";
    ctx.fillRect(Math.round(enemy.x) + (enemy.facing === 1 ? 12 : -3), enemy.y + 4, 2, 2);
  }
  if (ren) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i < enemy.hp ? "#ED9AA7" : "#4A3A44";
      ctx.fillRect(head.x - 8 + i * 3, head.y - 12, 2, 2);
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Game, state: DungeonState): void {
  const p = state.player;
  const escrow = game.run.dungeon.escrow?.gear;
  const gear: Gear = state.recovered && escrow ? { ...escrow } : { ...NO_GEAR, shinai: state.shinai, tare: state.pieces.includes("do"), do: state.pieces.includes("do"), kote: state.pieces.includes("kote") };
  const colors = playerColors({ ...game.run, equipped: {}, owned: [], look: "" });
  let x = p.x + PLAYER_W / 2;
  let feet = p.y + PLAYER_H;
  let pose: DuelPose;
  if (p.ledge && p.climb) {
    // Pulled up and over: rise first, then step in.
    const t = 1 - p.climb / CLIMB_TICKS;
    feet = p.ledge.y + 1 + PLAYER_H - Math.min(1, t * 1.6) * (PLAYER_H + 1);
    x += p.ledge.side * Math.max(0, t - 0.5) * 2 * (PLAYER_W / 2 + 1);
    pose = t < 0.6 ? "tellBigRaise" : "sonkyo";
  } else if (p.ledge) pose = "tellBigRaise";
  else if (state.phase === "dead") pose = "stunned";
  else if (p.attackTicks) pose = "strikeMen";
  else if (!p.grounded) pose = "launch";
  else if (game.input.isDown("down")) pose = "block";
  else pose = "guard";
  const running = p.grounded && Math.abs(p.vx) > 0.3 && !p.attackTicks;
  if (p.invulnerable && !game.reducedMotion && state.tick % 6 >= 3 && state.phase === "playing") return;
  drawSmallFighter(ctx, x, feet, pose, running ? (state.tick >> 2) % 3 : 0, gear, colors, p.facing === -1);
}

function drawSmallFighter(ctx: CanvasRenderingContext2D, x: number, y: number, pose: DuelPose, frame: number, gear: Gear, colors: Record<string, string>, flip: boolean): void {
  ctx.save();
  ctx.scale(0.5, 0.5);
  drawFighter(ctx, Math.round(x * 2), Math.round(y * 2), pose, "player", frame, gear, { colors, flip, showRibbon: false, weapon: gear.shinai ? "shinai" : "none" });
  ctx.restore();
}

/** What E would do right here, said above your head. */
function drawPrompt(ctx: CanvasRenderingContext2D, game: Game, state: DungeonState, camera: number): void {
  const p = state.player;
  if (!p.grounded || p.ledge) return;
  const room = DUNGEON_ROOMS[state.room];
  const close = (point: { x: number; y: number }, reach = 14) => Math.abs(p.x - point.x) <= reach && Math.abs(p.y - point.y) <= 10;
  let label = "";
  const pickup = room.pickups.find((item) => !state.collected.includes(item.id) && close(item) && !(item.kind === "chest" && state.enemies.some((enemy) => enemy.hp > 0)));
  if (pickup) label = PICKUP_LABELS[pickup.kind];
  else if (room.bench && close(room.bench, 18) && !state.pieces.includes("do")) label = `Make armor (${state.materials}/${SCRAP_FOR_ARMOR} scrap)`;
  else if (close(room.exit)) label = state.room === FINAL_ROOM ? "Climb out" : "Go on";
  if (label) drawInteractPrompt(ctx, label, p.x + PLAYER_W / 2 - Math.round(camera), p.y + PLAYER_H, keyLabel(game.input, "confirm", "e"));
}

function drawHud(ctx: CanvasRenderingContext2D, game: Game, mode: string, state: DungeonState, ambush: Ambush, talking: boolean): void {
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, 0, viewW, 24);
  const trial = mode === "trial" || mode === "escape";
  drawText(ctx, trial ? DUNGEON_ROOMS[state.room].name : "Under Thunder Radish Dojo", 4, 2, UI.accent);
  const hp = trial ? state.player.hp : mode === "ambush" ? ambush.hp : 3;
  const max = trial ? maxHp(state.pieces) : 3;
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < hp ? UI.bad : UI.track;
    ctx.fillRect(viewW - 6 - (max - i) * 8, 4, 6, 6);
  }
  if (trial) {
    const kit = state.recovered ? ["All your gear"] : [state.shinai ? "Shinai" : "No weapon", ...(state.pieces.includes("do") ? ["Do"] : state.materials ? [`Scrap ${state.materials}/${SCRAP_FOR_ARMOR}`] : []), ...(state.pieces.includes("kote") ? ["Kote"] : [])];
    drawText(ctx, kit.join("   "), 4, 13, state.shinai ? UI.text : UI.dim);
  } else drawText(ctx, mode === "lair" ? "A hidden stair" : `Ren   ${ambush.parries ? `Guarded ${ambush.parries}` : ""}`, 4, 13, UI.dim);
  ctx.fillStyle = UI.panel;
  ctx.fillRect(0, viewH - 22, viewW, 22);
  const k = (action: Parameters<typeof keyLabel>[1], fallback: string) => keyLabel(game.input, action, fallback);
  const top = mode === "lair" ? `${k("left", "a")}/${k("right", "d")} walk` : mode === "ambush" ? `${k("left", "a")}/${k("right", "d")} move   ${k("down", "s")} guard` : `${k("left", "a")}/${k("right", "d")} move   ${k("up", "w")} jump, hold to climb   ${k("down", "s")} guard`;
  const bottom = mode === "lair" ? `${k("confirm", "e")} look` : mode === "ambush" ? `${k("men", "j")} strike` : `${state.shinai ? `${k("men", "j")} strike   ` : ""}${k("confirm", "e")} use`;
  // While someone speaks, the dialogue says which keys work.
  if (talking) return;
  drawTextCentered(ctx, top, viewW / 2, viewH - 20, UI.dim);
  drawTextCentered(ctx, bottom, viewW / 2, viewH - 10, UI.dim);
}

function drawRetry(ctx: CanvasRenderingContext2D, game: Game, state: DungeonState): void {
  const lines = wrapText(state.cause || "You were caught.", 180);
  const height = 26 + lines.length * 10;
  const top = Math.floor(viewH / 2 - height / 2);
  ctx.fillStyle = UI.panel;
  ctx.fillRect(Math.floor(viewW / 2) - 100, top, 200, height);
  ctx.fillStyle = UI.edge;
  ctx.fillRect(Math.floor(viewW / 2) - 100, top, 200, 1);
  lines.forEach((line, i) => drawTextCentered(ctx, line, viewW / 2, top + 5 + i * 10, UI.bad));
  drawTextCentered(ctx, `${keyLabel(game.input, "confirm", "e")} try the room again`, viewW / 2, top + height - 13, UI.text);
}

