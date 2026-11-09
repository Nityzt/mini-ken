import test from "node:test";
import assert from "node:assert/strict";
import { KI_MAX, DRILL_STOMP_WINDOW } from "./constants.ts";
import { createKirikaeshi, KIRIKAESHI_SEQUENCE, KIRIKAESHI_TIERS, kirikaeshiTierFor, MISSES_ALLOWED, stepKirikaeshi, type KirikaeshiInput, type KirikaeshiState } from "./kirikaeshi.ts";

const IDLE: KirikaeshiInput = { left: false, right: false, men: false, stomp: false, hold: false };
type Player = (s: KirikaeshiState) => Partial<KirikaeshiInput>;

function play(player: Player, tier = 2, kiMax = KI_MAX): { end: KirikaeshiState; lowest: number; calls: number; kiais: number } {
  let s = createKirikaeshi({ tier, kiMax });
  let lowest = s.ki;
  let calls = 0;
  let kiais = 0;
  for (let t = 0; t < 7200 && !s.outcome; t++) {
    s = stepKirikaeshi(s, { ...IDLE, ...player(s) });
    lowest = Math.min(lowest, s.ki);
    for (const e of s.events) {
      if (e.type === "call") calls++;
      if (e.type === "kiai") kiais++;
    }
  }
  return { end: s, lowest, calls, kiais };
}

/** Strikes on every beat, right on time, with the right key. */
const clean = (overrides: { follow?: boolean; stomp?: boolean } = {}): Player => {
  const { follow = true, stomp = true } = overrides;
  return (s) => {
    if (s.phase === "follow") return { hold: follow };
    if (s.phase === "big") return { men: true, stomp };
    if (s.phase === "rhythm" && s.dueIn === 1) return { [KIRIKAESHI_SEQUENCE[s.beat].side!]: true };
    return {};
  };
};

test("the set is men, four forward, five back, men, four forward, five back, and a last men", () => {
  const shape = KIRIKAESHI_SEQUENCE.map((b) => (b.kind === "big" ? "M" : b.dir > 0 ? "f" : "b")).join("");
  assert.equal(shape, "MffffbbbbbMffffbbbbbM");
});

test("only the very last men has to be followed through", () => {
  const big = KIRIKAESHI_SEQUENCE.filter((b) => b.kind === "big");
  assert.deepEqual(big.map((b) => !!b.final), [false, false, true]);
});

test("sayu men alternate sides all the way through a chain", () => {
  const sides = KIRIKAESHI_SEQUENCE.slice(1, 10).map((b) => b.side);
  assert.deepEqual(sides, ["left", "right", "left", "right", "left", "right", "left", "right", "left"]);
});

test("a clean set passes at every tempo, on the bar you start the game with", () => {
  KIRIKAESHI_TIERS.forEach((_, tier) => {
    const { end } = play(clean(), tier);
    assert.equal(end.outcome, "passed");
    assert.equal(end.misses, 0);
  });
});

test("a clean set nearly empties a starting bar, so it's stamina that's being tested", () => {
  const { lowest } = play(clean());
  assert.ok(lowest > 0 && lowest < 30, `lowest ki ${lowest}`);
});

test("a bigger bar comes through the same set with far more left", () => {
  assert.ok(play(clean(), 2, 150).lowest > play(clean(), 2, 100).lowest + 30);
});

test("the last tempo is the video's: 27 ticks a strike", () => {
  assert.equal(KIRIKAESHI_TIERS.at(-1)!.interval, 27);
  assert.ok(KIRIKAESHI_TIERS[0].interval > KIRIKAESHI_TIERS.at(-1)!.interval);
});

test("each pass moves to the next tempo, and stays on the last", () => {
  assert.deepEqual([0, 1, 2, 9].map(kirikaeshiTierFor), [0, 1, 2, KIRIKAESHI_TIERS.length - 1]);
});

test("every sayu men is called, but only the three big men get a kiai", () => {
  const { calls, kiais } = play(clean());
  assert.equal(calls, 18);
  assert.equal(kiais, 3);
});

test("no ki comes back during a chain", () => {
  let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
  const player = clean();
  let before = s.ki;
  for (let t = 0; t < 7200 && !s.outcome; t++) {
    const wasRhythm = s.phase === "rhythm";
    s = stepKirikaeshi(s, { ...IDLE, ...player(s) });
    if (wasRhythm) assert.ok(s.ki <= before, `ki rose from ${before} to ${s.ki}`);
    before = s.ki;
  }
});

test("doing nothing loses the rhythm, however big your bar is", () => {
  const { end } = play(() => ({}), 2, 500);
  assert.equal(end.outcome, "lost");
  assert.equal(end.misses, MISSES_ALLOWED + 1);
});

test("running out of ki ends the set", () => {
  // A clean set bottoms out late in the second chain, so a couple of slips there are too many on a starting bar.
  const player = clean();
  const { end } = play((s) => (s.phase === "rhythm" && s.dueIn === 1 && s.beat >= 16 && s.misses < 3 ? { [KIRIKAESHI_SEQUENCE[s.beat].side === "left" ? "right" : "left"]: true } : player(s)));
  assert.equal(end.outcome, "winded");
  assert.ok(end.misses <= MISSES_ALLOWED);
});

test("the wrong side is a miss, and costs ki", () => {
  let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
  const player = clean();
  while (s.phase !== "rhythm") s = stepKirikaeshi(s, { ...IDLE, ...player(s) });
  while (s.dueIn !== 1) s = stepKirikaeshi(s, IDLE);
  const { ki, beat } = s;
  s = stepKirikaeshi(s, { ...IDLE, right: true });
  assert.equal(s.misses, 1);
  assert.equal(s.beat, beat);
  assert.ok(s.ki < ki);
  assert.ok(s.events.some((e) => e.type === "wrong"));
});

test("a strike anywhere inside the window lands, one before it is rushed, and one after it is late", () => {
  const { window } = KIRIKAESHI_TIERS[2];
  const at = (dueIn: number) => {
    let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
    const player = clean();
    while (s.phase !== "rhythm") s = stepKirikaeshi(s, { ...IDLE, ...player(s) });
    while (s.dueIn !== dueIn + 1) s = stepKirikaeshi(s, IDLE);
    return stepKirikaeshi(s, { ...IDLE, left: true }).events.map((e) => e.type);
  };
  assert.ok(at(window).includes("call"));
  assert.ok(at(-window).includes("call"));
  assert.ok(at(window + 1).includes("rushed"));
  assert.ok(at(-window - 1).includes("late"));
});

test("a strike that never comes counts as late, and the chain carries on", () => {
  let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
  const player = clean();
  while (s.phase !== "rhythm") s = stepKirikaeshi(s, { ...IDLE, ...player(s) });
  let late = false;
  while (s.beat === 1) {
    s = stepKirikaeshi(s, IDLE);
    late ||= s.events.some((e) => e.type === "late");
  }
  assert.ok(late);
  assert.equal(s.beat, 2);
  assert.equal(s.misses, 1);
});

test("a big men needs fumikomi", () => {
  let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
  while (s.phase !== "big") s = stepKirikaeshi(s, IDLE);
  const ki = s.ki;
  s = stepKirikaeshi(s, { ...IDLE, men: true });
  assert.ok(s.events.some((e) => e.type === "flat"));
  assert.equal(s.misses, 1);
  assert.ok(ki - s.ki > KIRIKAESHI_SEQUENCE[0].cost);
});

test("a stomp only counts if it's close enough before the strike", () => {
  const strikeAfter = (gap: number) => {
    let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
    while (s.phase !== "big") s = stepKirikaeshi(s, IDLE);
    s = stepKirikaeshi(s, { ...IDLE, stomp: true });
    for (let i = 1; i < gap; i++) s = stepKirikaeshi(s, IDLE);
    return stepKirikaeshi(s, { ...IDLE, men: true });
  };
  assert.equal(strikeAfter(DRILL_STOMP_WINDOW).misses, 0);
  assert.equal(strikeAfter(DRILL_STOMP_WINDOW + 1).misses, 1);
});

test("mashing men before the reset's over doesn't count for or against you", () => {
  let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
  assert.equal(s.phase, "breath");
  const { ki } = s;
  s = stepKirikaeshi(s, { ...IDLE, men: true });
  assert.equal(s.misses, 0);
  assert.equal(s.ki, ki);
  assert.equal(s.beat, 0);
});

test("the set doesn't end until the last men is followed through", () => {
  const { end, lowest } = play(clean({ follow: false }));
  assert.equal(end.outcome, "noFollow");
  assert.ok(lowest > 0);
});

test("the reset gives ki back, and never above the bar", () => {
  let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
  const player = clean();
  let sawRise = false;
  while (!s.outcome) {
    const before = s.ki;
    const wasBreath = s.phase === "breath";
    s = stepKirikaeshi(s, { ...IDLE, ...player(s) });
    if (wasBreath && s.ki > before) sawRise = true;
    assert.ok(s.ki <= KI_MAX);
  }
  assert.ok(sawRise);
});

test("the pair move forward on the first four and back on the five, keeping their distance", () => {
  let s = createKirikaeshi({ tier: 2, kiMax: KI_MAX });
  const player = clean();
  while (s.beat < 1 || s.phase !== "rhythm") s = stepKirikaeshi(s, { ...IDLE, ...player(s) });
  const start = s.playerX;
  const gap = s.partnerX - s.playerX;
  const atBeat = (beat: number) => {
    while (s.beat < beat) s = stepKirikaeshi(s, { ...IDLE, ...player(s) });
    return s.playerX;
  };
  assert.ok(atBeat(5) > start);
  assert.equal(s.partnerX - s.playerX, gap);
  const furthest = s.playerX;
  assert.ok(atBeat(9) < furthest);
  assert.equal(s.partnerX - s.playerX, gap);
});
