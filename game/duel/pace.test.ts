import test from "node:test";
import assert from "node:assert/strict";
import { FREEZE_BLOCK, FREEZE_HIT, TEMPO_FRAMES, TEMPO_TICKS } from "./constants.ts";
import { createRival, rivalAct, rivalConfig, type RivalStyle } from "./rival.ts";
import { ATTACKS, createDuel, distance, exposedTargets, ruleTick, skipBow, step, ticksNext, type AttackKind, type DuelState, type FighterInput } from "./rules.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const FRAMES_PER_SECOND = 60;
const seconds = (frames: number) => frames / FRAMES_PER_SECOND;

/** Squared up in range, with nothing going on yet. */
function inRange(gap = 40): DuelState {
  const s = skipBow(createDuel());
  s.fighters[0].x = s.fighters[1].x - gap;
  return s;
}

/** How many frames from pressing a strike to it landing. */
function pressToContact(attack: AttackKind): number {
  let s = step(inRange(), { ...IDLE, opening: "raise", attack, stomp: true }, { ...IDLE, block: true });
  let frames = 1;
  while (s.fighters[0].stance === "windup" || s.fighters[0].stance === "opening") {
    s = step(s, IDLE, { ...IDLE, block: true });
    frames++;
  }
  return frames;
}

test("the rules move on two of every three frames", () => {
  let s = inRange(100);
  const start = s.fighters[0].x;
  for (let i = 0; i < TEMPO_FRAMES * 10; i++) s = step(s, { ...IDLE, move: 1 }, IDLE);
  const oneTick = ruleTick(inRange(100), { ...IDLE, move: 1 }, IDLE).fighters[0].x - start;
  assert.ok(Math.abs(s.fighters[0].x - start - oneTick * TEMPO_TICKS * 10) < 1e-6);
});

test("no strike lands in under a quarter of a second, so it can be seen coming", () => {
  for (const attack of ["men", "kote", "do", "quickMen"] as const) {
    assert.ok(seconds(pressToContact(attack)) >= 0.25, `${attack}: ${seconds(pressToContact(attack))}s`);
  }
  assert.ok(seconds(pressToContact("men")) <= 0.7, "but your own strike still answers you");
});

test("a key pressed on a frame the rules skip still counts", () => {
  let s = inRange();
  while (ticksNext(s)) s = step(s, IDLE, IDLE);
  s = step(s, { ...IDLE, opening: "raise", stomp: true }, IDLE);
  assert.equal(s.fighters[0].stance, "guard");
  s = step(s, { ...IDLE, opening: "raise" }, IDLE);
  assert.equal(s.fighters[0].stance, "opening");
  assert.equal(s.fighters[0].stompAge, 0);
});

test("a press is only used once", () => {
  let s = inRange();
  while (ticksNext(s)) s = step(s, IDLE, IDLE);
  s = step(s, { ...IDLE, stomp: true }, IDLE);
  s = step(s, IDLE, IDLE);
  assert.equal(s.events.filter((e) => e.type === "stomp").length, 1);
  s = step(s, IDLE, IDLE);
  assert.equal(s.events.filter((e) => e.type === "stomp").length, 0);
});

/** Runs until something happens, and returns how long everything then holds still. */
function freezeAfter(event: string, defender: FighterInput): number {
  let s = inRange();
  s = step(s, { ...IDLE, opening: "raise", attack: "men", stomp: true }, defender);
  for (let i = 0; i < 200 && !s.events.some((e) => e.type === event); i++) s = step(s, IDLE, defender);
  assert.ok(s.events.some((e) => e.type === event), `never saw ${event}`);
  return s.freeze;
}

test("contact holds everything still, and bigger moments hold longer", () => {
  assert.equal(freezeAfter("hit", IDLE), FREEZE_HIT);
  assert.equal(freezeAfter("blocked", { ...IDLE, block: true }), FREEZE_BLOCK);
  assert.ok(FREEZE_HIT > FREEZE_BLOCK);
});

test("nothing moves during the freeze, and a press made during it waits", () => {
  let s = inRange();
  s = step(s, { ...IDLE, opening: "raise", attack: "men", stomp: true }, IDLE);
  while (!s.events.some((e) => e.type === "hit")) s = step(s, IDLE, IDLE);
  const held = s;
  for (let i = 0; i < FREEZE_HIT; i++) {
    s = step(s, { ...IDLE, move: 1 }, IDLE);
    assert.equal(s.ticked, false);
    assert.deepEqual(s.fighters, held.fighters);
    assert.equal(s.zanshin?.left, held.zanshin?.left);
  }
  assert.equal(s.freeze, 0);
  for (let i = 0; i < TEMPO_FRAMES && !s.ticked; i++) s = step(s, { ...IDLE, move: 1 }, IDLE);
  assert.equal(s.ticked, true);
});

test("a step doesn't change the state it was given", () => {
  const s = inRange();
  const before = structuredClone(s);
  step(s, { ...IDLE, opening: "raise", attack: "men", stomp: true }, IDLE);
  step(step(s, IDLE, IDLE), IDLE, IDLE);
  assert.deepEqual(s, before);
});

test("the bow and the closing don't run on the tempo: they have their own timing", () => {
  const s = createDuel();
  const next = step(s, IDLE, IDLE);
  const after = step(next, IDLE, IDLE);
  const third = step(after, IDLE, IDLE);
  assert.equal(third.phaseTicks, s.phaseTicks - 3);
});

test("a rival only decides when the rules are about to move, and keeps holding what it held", () => {
  let duel = inRange();
  let rival = createRival(1, rivalConfig(0, "steady"));
  for (let frame = 0; frame < 300; frame++) {
    const act = rivalAct(duel, rival);
    if (!ticksNext(duel)) {
      assert.equal(act.rival, rival);
      assert.equal(act.input.attack, null);
    }
    rival = act.rival;
    duel = step(duel, IDLE, act.input);
  }
});

/** Plays a match as a fast, accurate player would, and says how it went. Anything that scores quickly only makes this a lower bound. */
function playMatch(style: RivalStyle, seed: number, reaction: number): { frames: number; won: boolean; points: number; exchanges: number[] } {
  const config = rivalConfig(0, style);
  let s = skipBow(createDuel({ windups: [{}, { ...config.tell }] }));
  let rival = createRival(seed, config);
  let frames = 0;
  let seen = 0;
  let last = 0;
  const exchanges: number[] = [];
  while (s.phase !== "closing" && s.phase !== "over" && frames < FRAMES_PER_SECOND * 300) {
    const [me, them] = s.fighters;
    const gap = distance(s);
    const showing = them.stance === "windup" || them.stance === "opening";
    seen = showing ? seen + 1 : 0;
    let input = IDLE;
    if (s.phase === "zanshin" && s.zanshin?.by === 0) input = { ...IDLE, move: s.zanshin.dir };
    else if (s.lock) input = { ...IDLE, move: 1 };
    else if (me.stance === "guard" && gap > 44) input = { ...IDLE, move: 1 };
    else if (me.stance === "guard" && seen >= reaction && showing) input = { ...IDLE, opening: "wrist", attack: exposedTargets(them)[0], stomp: true };
    const act = rivalAct(s, rival);
    rival = act.rival;
    s = step(s, input, act.input);
    frames++;
    if (s.events.some((e) => ["hit", "blocked", "parry", "cross", "lock", "flat", "whiff"].includes(e.type))) {
      if (last) exchanges.push(frames - last);
      last = frames;
    }
  }
  return { frames, won: s.winner === 0, points: s.fighters[0].points + s.fighters[1].points, exchanges };
}

const TOURNAMENT_STYLES: RivalStyle[] = ["restless", "steady", "fierce", "relentless", "patient", "master", "sensei", "iron"];
const REACTION_FRAMES = 15;

test("a match lasts long enough to follow, even when one side is playing perfectly", () => {
  for (const style of TOURNAMENT_STYLES) {
    const runs = Array.from({ length: 30 }, (_, i) => playMatch(style, 100 + i, REACTION_FRAMES));
    const mean = runs.reduce((sum, r) => sum + seconds(r.frames), 0) / runs.length;
    assert.ok(mean >= 10, `${style}: ${mean.toFixed(1)}s a match`);
    const gaps = runs.flatMap((r) => r.exchanges).sort((a, b) => a - b);
    assert.ok(seconds(gaps[Math.floor(gaps.length / 2)]) >= 2.5, `${style}: ${seconds(gaps[Math.floor(gaps.length / 2)]).toFixed(1)}s between exchanges`);
  }
});

test("there's time to read a tell and answer it: a slow reaction still scores", () => {
  // 400ms from the tell appearing is well past a quick reaction, and still has to beat them to it.
  const slow = Math.round(0.4 * FRAMES_PER_SECOND);
  for (const style of ["steady", "master", "sensei", "relentless"] as const) {
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++) if (playMatch(style, seed, slow).won) wins++;
    assert.ok(wins >= 10, `${style}: ${wins} of 20 at ${slow} frames`);
  }
});

test("every rival's tell leaves at least 400ms once your own strike's length is taken off", () => {
  const slowest = Math.max(ATTACKS.men.windup, ATTACKS.kote.windup, ATTACKS.do.windup);
  for (const style of TOURNAMENT_STYLES) {
    const { tell } = rivalConfig(0, style);
    // Their opening and strike last their tell, a shortest opening and a little more. Yours has to fit inside that, with the same shortest opening of your own.
    const ticks = Math.min(tell.men, tell.kote) + 2 - slowest;
    assert.ok((ticks * TEMPO_FRAMES) / TEMPO_TICKS / FRAMES_PER_SECOND >= 0.4, `${style}: ${ticks} ticks`);
  }
});
