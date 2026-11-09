import test from "node:test";
import { directDuel as createDuel } from "../duel/test-support.ts";
import assert from "node:assert/strict";
import { measureText } from "../art/font.ts";
import { STAGE_W } from "../core/scale.ts";
import { FLAG_AFTER_HIT, FREEZE_HIT, PARRY_SHINE_LEAD } from "../duel/constants.ts";
import { fighterStatus } from "../duel/hud.ts";
import { FX_LIFE } from "../art/duel-fx.ts";
import { ATTACKS, skipBow, startX, step, type DuelEvent, type FighterInput } from "../duel/rules.ts";
import { CALL_HAJIME, CALL_NIHONME, CALL_SHOBU, CLOSING_LINE } from "./content.ts";
import { applyEvents, blendOf, createDuelView, createPlayerControl, helpLine, lockHelp, playShineTing, refereeCall, tickView, hpSlot } from "./duel.ts";
import type { GameAudio, SoundName } from "../core/audio.ts";
import type { Input } from "../core/input.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };

test("the lock's controls and the closing line fit on one row of the narrowest screen", () => {
  for (const line of [lockHelp(true), lockHelp(false)]) assert.ok(measureText(line) <= STAGE_W - 8, line);
  assert.ok(measureText(CLOSING_LINE) <= STAGE_W - 8, `${measureText(CLOSING_LINE)}`);
});

test("the referee calls hajime to begin, nihon-me after one point, and shobu at one all", () => {
  const duel = createDuel();
  assert.equal(refereeCall(duel, "bow"), CALL_HAJIME);
  assert.equal(refereeCall(duel, "wakare"), CALL_HAJIME);
  duel.fighters[0].points = 1;
  assert.equal(refereeCall(duel, "point"), CALL_NIHONME);
  duel.fighters[1].points = 1;
  assert.equal(refereeCall(duel, "point"), CALL_SHOBU);
  assert.equal(refereeCall(duel, "zanshin"), null);
});

test("words said at the same moment are stacked, not printed on top of each other", () => {
  const view = createDuelView(skipBow(createDuel()));
  const events: DuelEvent[] = [{ type: "parry", by: 0 }, { type: "kiai", by: 0, target: "men" }, { type: "blocked", by: 0 }];
  applyEvents(view, events, true);
  const heights = view.floaters.map((f) => f.y);
  assert.equal(new Set(heights).size, heights.length, heights.join());
});

test("words far enough apart can share a height", () => {
  const view = createDuelView(skipBow(createDuel()));
  applyEvents(view, [{ type: "kiai", by: 0, target: "men" }, { type: "kiai", by: 1, target: "kote" }], true);
  assert.equal(view.floaters[0].y, view.floaters[1].y);
});

test("a pose change remembers where it came from, so it can be blended", () => {
  const duel = skipBow(createDuel());
  const view = createDuelView(duel);
  tickView(view);
  view.duel = step(view.duel, { ...IDLE, block: true }, IDLE);
  tickView(view);
  assert.equal(view.poses[0].now, "block");
  assert.equal(view.poses[0].was, "guard");
  assert.equal(view.poses[0].age, 0);
  tickView(view);
  assert.equal(view.poses[0].age, 1);
});

test("a call shows once as the fight begins", () => {
  const view = createDuelView(createDuel());
  view.duel = skipBow(view.duel);
  tickView(view);
  assert.deepEqual(view.floaters.map((f) => f.text), [CALL_HAJIME]);
  tickView(view);
  assert.equal(view.floaters.length, 1);
});

test("the flags come down when the closing ceremony starts", () => {
  const view = createDuelView(skipBow(createDuel()));
  view.flags = "red";
  view.duel = { ...view.duel, phase: "closing", phaseTicks: 100 };
  tickView(view);
  assert.equal(view.flags, null);
});

test("a hit leaves the one who took it reacting and knocked back, and it wears off", () => {
  const view = createDuelView(skipBow(createDuel()));
  applyEvents(view, [{ type: "hit", by: 0, target: "men" }], true);
  assert.equal(view.reaction[1]?.pose, "hit");
  assert.ok(view.knock[1] > 0);
  for (let i = 0; i < 40; i++) tickView(view);
  assert.equal(view.reaction[1], null);
  assert.equal(view.knock[1], 0);
});

test("once it's over, the fighters keep walking off", () => {
  const view = createDuelView(skipBow(createDuel()));
  view.duel = { ...view.duel, phase: "over" };
  tickView(view);
  tickView(view);
  assert.equal(view.overTicks, 2);
  assert.equal(view.duel.fighters[0].x, startX(0));
});

const keys = (down: string[]): Input => ({ isDown: (a: string) => down.includes(a), wasPressed: (a: string) => down.includes(a), endTick() {}, clear() {}, dispose() {} }) as unknown as Input;

test("keys mean left and right on the screen, so they swap in the rules once you've crossed", () => {
  const me = { stance: "guard" as const };
  assert.equal(createPlayerControl()(keys(["right"]), me, true, false).move, 1);
  assert.equal(createPlayerControl()(keys(["right"]), me, true, true).move, -1);
  assert.equal(createPlayerControl()(keys(["left"]), me, true, true).move, 1);
  assert.equal(createPlayerControl()(keys([]), me, true, true).move, 0);
});

test("the lock's keys swap when you're on the other side", () => {
  assert.ok(lockHelp(true).startsWith("D push"));
  assert.ok(lockHelp(false).startsWith("A push"));
});

test("every help line fits, the crossing one included", () => {
  for (let tick = 0; tick < 2000; tick += 100) assert.ok(measureText(helpLine(tick)) <= STAGE_W + 4, helpLine(tick));
});

test("once crossed, things said appear where the fighters really are on the screen", () => {
  const view = createDuelView(skipBow(createDuel()));
  const { x } = view.duel.fighters[0];
  view.duel = { ...view.duel, crossed: true };
  applyEvents(view, [{ type: "kiai", by: 0, target: "men" }], true);
  assert.equal(view.floaters[0].x, 256 - x);
});

/** Plays out one swing by fighter `by`, and notes how many ticks were left whenever the ting played. */
function tingsDuringSwing(by: 0 | 1, you: 0 | 1, options: Parameters<typeof createDuel>[0] = {}, attack: "men" | "quickMen" = "men"): number[] {
  const view = createDuelView(skipBow(createDuel({ windups: [{ men: 30 }, { men: 30 }], ...options })));
  view.duel.fighters[0].x = 110;
  view.duel.fighters[1].x = 150;
  const heard: SoundName[] = [];
  const audio: GameAudio = { play: (name) => heard.push(name), say: () => {}, toggleMute: () => false, unlock: () => {} };
  const left: number[] = [];
  const swing: FighterInput = { ...IDLE, attack };
  view.duel = step(view.duel, by === 0 ? swing : IDLE, by === 1 ? swing : IDLE);
  for (let i = 0; i < 40 && view.duel.phase === "fight"; i++) {
    heard.length = 0;
    playShineTing(audio, view, you);
    if (heard.includes("ting")) left.push(view.duel.fighters[by].stanceTicks);
    view.duel = step(view.duel, IDLE, IDLE);
  }
  return left;
}

test("the ting plays once per strike, the moment the shine appears", () => {
  assert.deepEqual(tingsDuringSwing(1, 0), [PARRY_SHINE_LEAD]);
});

test("your own swing makes no ting, whichever side you're on", () => {
  assert.deepEqual(tingsDuringSwing(0, 0), []);
  assert.deepEqual(tingsDuringSwing(1, 1), []);
  assert.deepEqual(tingsDuringSwing(0, 1), [PARRY_SHINE_LEAD]);
});

test("a strike quicker than the lead tings as it starts", () => {
  assert.deepEqual(tingsDuringSwing(1, 0, {}, "quickMen"), [ATTACKS.quickMen.windup - 1]);
});

test("no shine, no ting: a basic lesson has no parry to cue", () => {
  assert.deepEqual(tingsDuringSwing(1, 0, { basics: true }), []);
});

/** Plays a real clean hit by fighter 0, then runs the view forward with this input until the given test passes. */
function hitInView(by: 0 | 1 = 0) {
  const swing: FighterInput = { ...IDLE, attack: "men", stomp: true };
  const view = createDuelView(skipBow(createDuel({ windups: [{ men: 8 }, { men: 8 }] })));
  view.duel.fighters[0].x = 110;
  view.duel.fighters[1].x = 150;
  const go = (a: FighterInput, b: FighterInput) => {
    view.duel = step(view.duel, a, b);
    applyEvents(view, view.duel.events, true);
    tickView(view);
  };
  go(by === 0 ? swing : IDLE, by === 1 ? swing : IDLE);
  while (view.duel.phase === "fight") go(by === 0 ? { ...IDLE, stomp: true } : IDLE, by === 1 ? { ...IDLE, stomp: true } : IDLE);
  assert.equal(view.duel.phase, "zanshin");
  return { view, go };
}

test("the flag goes up as they finish passing, before the point's settled", () => {
  const { view, go } = hitInView();
  assert.equal(view.flags, null);
  // The tick of the hit counts as the first, and the freeze on contact doesn't count at all.
  const oneTick = () => {
    go(IDLE, IDLE);
    while (!view.duel.ticked) go(IDLE, IDLE);
  };
  for (let i = 2; i < FLAG_AFTER_HIT; i++) {
    oneTick();
    assert.equal(view.flags, null, `tick ${i}`);
  }
  oneTick();
  assert.equal(view.flags, "red");
  assert.equal(view.duel.phase, "zanshin");
  assert.deepEqual(view.duel.fighters.map((f) => f.points), [0, 0]);
});

test("the flag's the color of whoever struck", () => {
  const { view, go } = hitInView(1);
  while (view.flags === null) go(IDLE, IDLE);
  assert.equal(view.flags, "white");
});

test("stopping short takes the point back, and the flag comes down", () => {
  const { view, go } = hitInView();
  while (view.flags === null) go(IDLE, IDLE);
  assert.equal(view.flags, "red");
  while (view.duel.phase === "zanshin") go(IDLE, IDLE);
  assert.equal(view.duel.phase, "fight");
  assert.equal(view.flags, null);
  assert.deepEqual(view.duel.fighters.map((f) => f.points), [0, 0]);
});

test("finishing zanshin keeps the flag up, and an old hit can't raise it again later", () => {
  const { view, go } = hitInView();
  const through: FighterInput = { ...IDLE, move: 1 };
  while (view.duel.phase === "zanshin") go(through, IDLE);
  assert.equal(view.duel.phase, "point");
  assert.equal(view.flags, "red");
  while (view.duel.phase === "point") go(IDLE, IDLE);
  for (let i = 0; i < FLAG_AFTER_HIT + 2; i++) {
    go(IDLE, IDLE);
    assert.equal(view.flags, null);
  }
});

test("your HP stays clear of the range label, however long your name is", () => {
  const width = 320;
  const short = hpSlot(30, 2, 60, width);
  assert.equal(short.y, 2, "beside your name when there's room");
  const long = hpSlot(120, 2, 100, width);
  assert.deepEqual(long, { x: 111, y: 10 }, "after your ki bar when there isn't");
});

/** What each thing that can happen leaves on screen, on its own. */
function effectOf(type: DuelEvent["type"]): string[] {
  const view = createDuelView(skipBow(createDuel()));
  applyEvents(view, [{ type, by: 0, target: "men" }], true);
  return view.fx.map((fx) => fx.kind);
}

test("every outcome of a strike looks different from every other", () => {
  const outcomes: DuelEvent["type"][] = ["hit", "blocked", "parry", "flat", "whiff", "aiuchi", "cross", "broken"];
  const looks = outcomes.map((type) => effectOf(type).join());
  for (const [i, look] of looks.entries()) assert.notEqual(look, "", outcomes[i]);
  assert.equal(new Set(looks).size, outcomes.length, looks.join(" "));
});

test("seme's moments, footwork and the lock each have a look too", () => {
  for (const type of ["shout", "shaken", "stomp", "launch", "shove", "taiatari", "nozanshin"] as const) assert.equal(effectOf(type).length, 1, type);
});

test("effects run their course and go", () => {
  const view = createDuelView(skipBow(createDuel()));
  applyEvents(view, [{ type: "hit", by: 0, target: "men" }], true);
  for (let i = 0; i < FX_LIFE.strike; i++) tickView(view);
  assert.deepEqual(view.fx, []);
});

test("the freeze holds the strike out and the reaction on, and the pose still arrives", () => {
  const { view, go } = hitInView();
  const strike = view.strikeTicks[0];
  const hurt = view.reaction[1]?.ticks;
  while (view.duel.freeze > 1) go(IDLE, IDLE);
  assert.equal(view.strikeTicks[0], strike);
  assert.equal(view.reaction[1]?.ticks, hurt);
  assert.equal(blendOf(view.poses[0]), 1);
  go(IDLE, IDLE);
  go(IDLE, IDLE);
  assert.ok(view.strikeTicks[0] < strike);
});

test("poses arrive in held steps, with something new showing from the very first frame", () => {
  const arriving = (age: number) => blendOf({ now: "strikeMen", was: "guard", age });
  assert.ok(arriving(0) > 0);
  assert.equal(arriving(0), arriving(1));
  assert.equal(arriving(1), arriving(2));
  assert.ok(arriving(3) > arriving(2));
  assert.equal(arriving(60), 1);
});

test("someone walking doesn't flicker between walking and standing on the frames the rules skip", () => {
  const view = createDuelView(skipBow(createDuel()));
  const walk: FighterInput = { ...IDLE, move: 1 };
  for (let i = 0; i < 3; i++) {
    view.duel = step(view.duel, walk, IDLE);
    tickView(view);
  }
  for (let i = 0; i < 12; i++) {
    view.duel = step(view.duel, walk, IDLE);
    tickView(view);
    assert.equal(view.moving[0], true, `frame ${i}`);
  }
});

test("anyone left open says so, with how long's left, and a clean guard says nothing", () => {
  const duel = skipBow(createDuel());
  assert.equal(fighterStatus(duel, 0), null);
  duel.fighters[0].stance = "recovery";
  duel.fighters[0].stanceTicks = 11;
  assert.deepEqual(fighterStatus(duel, 0), { kind: "open", ticks: 11 });
  duel.fighters[1].stance = "broken";
  duel.fighters[1].stanceTicks = 20;
  assert.equal(fighterStatus(duel, 1)?.kind, "stunned");
  assert.equal(fighterStatus({ ...duel, phase: "point" }, 0), null);
});

test("in the lock, what each of them is doing shows", () => {
  const duel = skipBow(createDuel());
  duel.lock = { ticks: 0, balance: 0, pushing: [true, false], guarding: [false, true], pulling: [null, { attack: "men", ticks: 5, total: 14 }] };
  assert.equal(fighterStatus(duel, 0)?.kind, "push");
  assert.deepEqual(fighterStatus(duel, 1), { kind: "pull", ticks: 5, total: 14 });
  duel.lock.pulling[1] = null;
  assert.equal(fighterStatus(duel, 1)?.kind, "hold");
});

test("a strike pressed during a freeze isn't lost", () => {
  const control = createPlayerControl();
  const pressed = new Set(["men"]);
  const input = { wasPressed: (a: string) => pressed.has(a), isDown: () => false } as unknown as Input;
  assert.equal(control(input, { stance: "recovery" }).attack, null);
  pressed.clear();
  for (let i = 0; i < FREEZE_HIT; i++) assert.equal(control(input, { stance: "recovery" }).attack, null);
  assert.equal(control(input, { stance: "opening" }).attack, "men");
});

test("only the newest few words stay up", () => {
  const view = createDuelView(skipBow(createDuel()));
  for (const type of ["blocked", "whiff", "parry", "flat", "broken"] as const) applyEvents(view, [{ type, by: 0 }], true);
  assert.equal(view.floaters.length, 3);
  assert.equal(view.floaters.at(-1)?.text, "Guard broken!");
});
