import test from "node:test";
import assert from "node:assert/strict";
import { HIT_DAMAGE, OPEN_DURING_TELL, type BrawlSpec } from "./brawl.ts";
import { RANGE_MAX } from "./constants.ts";
import { createLine, createStreet, LINE_TIERS, linePassed, stepLine, STREET_GUARD_MIN, STREET_PROMPT_FIGHTS, streetLabels, type LineState, type StreetPace } from "./line.ts";
import { OPENING_POSE } from "./poses.ts";
import type { AttackKind, FighterInput, Target } from "./rules.ts";
import { GANG_PACE, GANGS } from "../world/map.ts";
import { LADDER } from "../progress.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
type Player = (s: LineState) => FighterInput;

const gangOf = (id: string): BrawlSpec[] => GANGS[id];
const LADDER_ORDER = LADDER.map((row) => row.id as string).filter((id) => GANGS[id]);
const HARDEST = LADDER_ORDER[LADDER_ORDER.length - 1];

const open = (s: LineState): Target | null => (s.active === null ? null : s.brawl.bullies[s.active].opening);
const canAct = (s: LineState) => s.brawl.player.stance === "guard";

function fight(player: Player, gang: string, seed = 1, options: { hp?: number; ticks?: number } = {}): LineState {
  let s = createStreet({ gang: GANGS[gang], pace: GANG_PACE[gang], labels: false, seed, hp: options.hp });
  for (let t = 0; t < (options.ticks ?? 20000) && !s.done; t++) s = stepLine(s, player(s));
  return s;
}

/** Walks on, waits for the opening and answers it the way the line drill asks. */
const reader = (options: { stomp?: boolean; slide?: boolean; wrong?: boolean; delay?: number } = {}): Player => {
  const { stomp = true, slide = true, wrong = false, delay = 0 } = options;
  let waited = 0;
  return (s) => {
    if (s.brawl.zanshin) return { ...IDLE, move: slide ? 1 : 0 };
    const target = open(s);
    if (!target) {
      waited = 0;
      return { ...IDLE, move: 1 };
    }
    if (!canAct(s) || waited++ < delay) return IDLE;
    const attack: AttackKind = wrong ? (target === "men" ? "kote" : "men") : target;
    return { ...IDLE, attack, stomp };
  };
};

/** Holds D and hits every key with the stomp, as fast as the game takes them. */
const masher = (attacks: AttackKind[]): Player => {
  let i = 0;
  return (s) => {
    if (s.brawl.zanshin) return { ...IDLE, move: 1 };
    if (!canAct(s)) return { ...IDLE, move: 1 };
    return { ...IDLE, move: 1, attack: attacks[i++ % attacks.length], stomp: true };
  };
};

test("a street fight is the line drill applied: a clean reader clears every gang without being touched", () => {
  for (const gang of Object.keys(GANGS)) {
    for (let seed = 1; seed <= 8; seed++) {
      const s = fight(reader(), gang, seed);
      assert.equal(s.brawl.phase, "won", `${gang} seed ${seed}`);
      assert.equal(linePassed(s), true);
      assert.equal(s.misses, 0, `${gang} seed ${seed}`);
      assert.equal(s.brawl.hp, 100, `${gang} seed ${seed}`);
    }
  }
});

test("mashing loses every street fight, whichever keys you mash", () => {
  const mashes: AttackKind[][] = [["men"], ["do"], ["kote"], ["men", "kote", "do"], ["do", "kote"], ["kote", "men", "do", "do"]];
  for (const gang of ["market", "bridge", HARDEST]) {
    for (const keys of mashes) {
      for (let seed = 1; seed <= 6; seed++) {
        const s = fight(masher(keys), gang, seed);
        assert.equal(s.brawl.phase, "lost", `${gang} ${keys} seed ${seed}: ${s.brawl.phase}, ${s.results}`);
      }
    }
  }
});

test("doing nothing loses: they don't wait for you, they come and hit you", () => {
  for (const gang of ["market", HARDEST]) {
    const s = fight(() => IDLE, gang, 1);
    assert.equal(s.brawl.phase, "lost", gang);
    assert.equal(s.brawl.hp, 0);
    assert.ok(s.brawl.bullies[0].x < GANGS[gang][0].x, "the first one walked up to you");
  }
});

test("the gang comes one at a time, and each opens up only once they've walked into range", () => {
  let s = createStreet({ gang: gangOf("wharf"), pace: GANG_PACE.wharf, labels: false, seed: 3 });
  for (let t = 0; t < 2000 && !open(s); t++) {
    s = stepLine(s, IDLE);
    assert.ok(s.brawl.bullies.filter((b) => b.opening).length <= 1);
    assert.ok(s.brawl.bullies.slice(1).every((b) => b.state === "wait"));
  }
  assert.equal(s.active, 0);
  assert.ok(s.brawl.bullies[0].x - s.brawl.player.x <= RANGE_MAX);
});

test("what's open is what the bully does, the same as the line drill's opening for that target", () => {
  assert.deepEqual(OPEN_DURING_TELL, { fist: "do", stick: "kote", grab: "men" });
  for (const gang of Object.keys(GANGS)) {
    const s = createStreet({ gang: GANGS[gang], pace: GANG_PACE[gang], labels: false, seed: 1 });
    assert.deepEqual(s.openings, GANGS[gang].map((b) => OPEN_DURING_TELL[b.kind]));
  }
  // Each target has a tell of its own, so fists up and a raised stick don't look alike.
  assert.equal(new Set(Object.values(OPEN_DURING_TELL).map((t) => OPENING_POSE[t])).size, 3);
});

/** Plays the reader up to the first opening, then lets `then` answer it. */
function firstAnswer(then: Player, gang = "market"): LineState {
  let s = createStreet({ gang: GANGS[gang], pace: GANG_PACE[gang], labels: false, seed: 2 });
  const walk = reader();
  for (let t = 0; t < 2000 && !open(s); t++) s = stepLine(s, walk(s));
  for (let t = 0; t < 600 && s.misses === 0 && s.results[0] === null && !s.done; t++) s = stepLine(s, then(s));
  return s;
}

test("each wrong answer is a miss, and the bully makes you pay for it", () => {
  const cases: [string, Player][] = [
    ["wrong target", reader({ wrong: true })],
    ["no stomp", reader({ stomp: false })],
    ["no follow-through", reader({ slide: false })],
    ["too slow", () => IDLE],
  ];
  for (const [name, player] of cases) {
    const s = firstAnswer(player);
    assert.equal(s.misses, 1, name);
    assert.equal(s.results[0], null, `${name}: still standing`);
    assert.equal(s.brawl.hp, 100 - HIT_DAMAGE[gangOf("market")[0].kind], name);
  }
});

test("striking before they open up is a miss too", () => {
  let s = createStreet({ gang: gangOf("market"), pace: GANG_PACE.market, labels: false, seed: 2 });
  for (let t = 0; t < 2000 && !(s.brawl.bullies[0].state === "guard"); t++) s = stepLine(s, IDLE);
  s = stepLine(s, { ...IDLE, attack: "do", stomp: true });
  let notes: string[] = [];
  for (let t = 0; t < 20 && s.misses === 0; t++) {
    s = stepLine(s, IDLE);
    notes = [...notes, ...s.notes];
  }
  assert.equal(s.misses, 1);
  assert.ok(notes.includes("early"));
});

test("they stay shut longer than a swing takes, so a mashed strike always lands before the opening", () => {
  // The slowest strike and its recovery, from a tired player.
  assert.ok(STREET_GUARD_MIN > 10 + 26);
});

test("after hitting you, a bully comes again, and the next clean answer still drops them", () => {
  let missed = false;
  const player: Player = (s) => {
    if (!missed && open(s)) {
      if (s.misses > 0) missed = true;
      return canAct(s) ? { ...IDLE, attack: open(s) === "men" ? "do" : "men", stomp: true } : IDLE;
    }
    return reader()(s);
  };
  let s = createStreet({ gang: gangOf("market"), pace: GANG_PACE.market, labels: false, seed: 4 });
  const answer = reader();
  for (let t = 0; t < 20000 && !s.done; t++) s = stepLine(s, s.misses === 0 ? player(s) : answer(s));
  assert.equal(s.brawl.phase, "won");
  assert.equal(s.misses, 1);
});

test("coming in hurt, you go down sooner", () => {
  const s = fight(() => IDLE, "market", 1, { hp: HIT_DAMAGE.fist });
  assert.equal(s.brawl.phase, "lost");
  assert.equal(s.misses, 1);
});

test("walking back off the start leaves the fight without a win", () => {
  const s = fight(() => ({ ...IDLE, move: -1 }), "market");
  assert.equal(s.brawl.phase, "fled");
  assert.equal(s.left, true);
  assert.equal(linePassed(s), false);
});

test("later fights are longer and quicker, with more sticks, like the harder line runs", () => {
  const sticks = (gang: string) => GANGS[gang].filter((b) => b.kind === "stick").length;
  const pace = (gang: string): StreetPace => GANG_PACE[gang];
  assert.deepEqual(Object.keys(GANG_PACE).sort(), Object.keys(GANGS).sort());
  for (let i = 1; i < LADDER_ORDER.length; i++) {
    const [was, now] = [LADDER_ORDER[i - 1], LADDER_ORDER[i]];
    assert.ok(GANGS[now].length >= GANGS[was].length, now);
    assert.ok(sticks(now) >= sticks(was), now);
    assert.ok(pace(now).window <= pace(was).window, now);
    assert.ok(pace(now).approach >= pace(was).approach, now);
  }
  assert.ok(GANGS[HARDEST].length > gangOf("market").length);
  assert.ok(pace(HARDEST).window < pace("market").window);
  // Market Street is the first line run's pace, and the hardest street is quicker than the hardest line run.
  assert.equal(pace("market").window, LINE_TIERS[0].window);
  assert.ok(pace(HARDEST).window < LINE_TIERS[LINE_TIERS.length - 1].window);
});

test("every gang asks for all three targets, like every line", () => {
  for (const gang of Object.keys(GANGS)) assert.equal(new Set(GANGS[gang].map((b: BrawlSpec) => OPEN_DURING_TELL[b.kind])).size, 3, gang);
});

test("the keys show for your first fight or two, and never after", () => {
  assert.equal(STREET_PROMPT_FIGHTS, 2);
  assert.equal(streetLabels(0), true);
  assert.equal(streetLabels(1), true);
  assert.equal(streetLabels(2), false);
  assert.equal(streetLabels(6), false);
});

test("the line drill itself is unchanged: nobody in it hits you or walks at you", () => {
  let s = createLine({ tier: 0, seed: 1 });
  const xs = s.brawl.bullies.map((b) => b.x);
  for (let t = 0; t < 2000; t++) s = stepLine(s, IDLE);
  assert.equal(s.brawl.hp, 100);
  assert.deepEqual(s.brawl.bullies.map((b) => b.x), xs);
  assert.equal(s.street, null);
});

test("stepLine doesn't change the street it was given", () => {
  const s = createStreet({ gang: gangOf("market"), pace: GANG_PACE.market, labels: true, seed: 1 });
  const before = structuredClone(s);
  stepLine(s, { ...IDLE, move: 1 });
  assert.deepEqual(s, before);
});
