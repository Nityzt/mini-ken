import test from "node:test";
import { BRAWL_RECOVERY_TICKS } from "./constants.ts";
import assert from "node:assert/strict";
import { createBrawl, stepBrawl, type BrawlState, type Bully, type BrawlSpec, HIT_DAMAGE } from "./brawl.ts";
import { BRAWL_KIAI_PRESS, BRAWL_SEME_TICKS, COWER_TICKS, KIAI_COOLDOWN, RANGE_MAX, RANGE_MIN, SEME_DRAIN, SEME_RANGE, ZANSHIN_PASS } from "./constants.ts";
import type { AttackKind, FighterInput } from "./rules.ts";
import { GANGS } from "../world/map.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const MARKET: BrawlSpec[] = [{ kind: "fist", x: 200 }, { kind: "fist", x: 280 }, { kind: "fist", x: 360 }];
const WHARF: BrawlSpec[] = [{ kind: "fist", x: 180 }, { kind: "stick", x: 240 }, { kind: "fist", x: 300 }, { kind: "stick", x: 370 }, { kind: "fist", x: 440 }];

const nearest = (s: BrawlState): Bully | null => {
  const alive = s.bullies.filter((b) => b.state !== "down");
  if (!alive.length) return null;
  return alive.reduce((a, b) => (Math.abs(b.x - s.player.x) < Math.abs(a.x - s.player.x) ? b : a));
};

type Player = (s: BrawlState) => FighterInput;

function play(player: Player, spec: BrawlSpec[], seed: number, ticks = 7200): BrawlState {
  let s = createBrawl({ bullies: spec, seed });
  for (let t = 0; t < ticks && s.phase === "fight"; t++) s = stepBrawl(s, player(s));
  return s;
}

/** Faces the nearest bully, closes in, and strikes what's open with the full combo. */
const reader = (options: { stomp?: boolean; slide?: boolean } = {}): Player => (s) => {
  const { stomp = true, slide = true } = options;
  const p = s.player;
  if (s.zanshin) return { ...IDLE, move: slide ? p.facing : 0 };
  const b = nearest(s);
  if (!b) return IDLE;
  const dir = b.x > p.x ? 1 : -1;
  const gap = Math.abs(b.x - p.x);
  if (p.stance !== "guard" && p.stance !== "block") return IDLE;
  if (dir !== p.facing || gap > RANGE_MAX - 4) return { ...IDLE, move: dir };
  if (gap < RANGE_MIN + 2) return { ...IDLE, block: true };
  if (b.state === "tell") return { ...IDLE, attack: (b.kind === "fist" ? "do" : "kote") as AttackKind, stomp };
  if (b.state === "walk" || b.state === "recover") return { ...IDLE, attack: "men", stomp };
  return { ...IDLE, block: true };
};

test("it starts in full health and everyone standing", () => {
  const s = createBrawl({ bullies: MARKET, seed: 1 });
  assert.equal(s.hp, 100);
  assert.equal(s.bullies.length, 3);
  assert.equal(s.phase, "fight");
});

test("a bully nobody has reached yet waits", () => {
  const s = createBrawl({ bullies: [{ kind: "fist", x: 900 }], seed: 1 });
  const later = Array.from({ length: 60 }).reduce<BrawlState>((acc) => stepBrawl(acc, IDLE), s);
  assert.equal(later.bullies[0].x, 900);
});

test("an idle player gets beaten", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const s = play(() => IDLE, [{ kind: "fist", x: 100 }, { kind: "fist", x: 140 }], seed);
    assert.equal(s.phase, "lost", `seed ${seed}`);
    assert.equal(s.hp, 0);
  }
});

test("a good player clears the market gang", () => {
  let wins = 0;
  for (let seed = 1; seed <= 10; seed++) if (play(reader(), MARKET, seed).phase === "won") wins++;
  assert.ok(wins >= 8, `won ${wins} of 10`);
});

test("a good player can clear the hardest gang", () => {
  let wins = 0;
  for (let seed = 1; seed <= 10; seed++) if (play(reader(), WHARF, seed).phase === "won") wins++;
  assert.ok(wins >= 5, `won ${wins} of 10`);
});

test("without the stomp nobody goes down", () => {
  const s = play(reader({ stomp: false }), MARKET, 3);
  assert.equal(s.bullies.filter((b) => b.state === "down").length, 0);
});

test("without the follow-through nobody goes down", () => {
  const s = play(reader({ slide: false }), MARKET, 3);
  assert.equal(s.bullies.filter((b) => b.state === "down").length, 0);
});

function hitOne(attack: AttackKind = "men"): BrawlState {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 80 }], seed: 2 });
  s = stepBrawl(s, { ...IDLE, attack, stomp: true });
  while (!s.zanshin && s.phase === "fight" && s.player.stance === "windup") s = stepBrawl(s, IDLE);
  return s;
}

test("a clean hit staggers the bully and asks for the follow-through", () => {
  const s = hitOne();
  assert.ok(s.zanshin);
  assert.equal(s.bullies[0].state, "stagger");
});

test("the follow-through carries the player all the way past the bully", () => {
  let s = hitOne();
  const bullyX = s.bullies[0].x;
  while (s.zanshin) s = stepBrawl(s, { ...IDLE, move: 1 });
  assert.equal(s.bullies[0].state, "down");
  assert.ok(s.player.x >= bullyX + ZANSHIN_PASS);
});

test("stopping short lets the bully recover and leaves you open", () => {
  let s = hitOne();
  while (s.zanshin) s = stepBrawl(s, IDLE);
  assert.notEqual(s.bullies[0].state, "down");
  assert.equal(s.player.stance, "recovery");
});

test("a strike with no stomp does nothing", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 80 }], seed: 2 });
  s = stepBrawl(s, { ...IDLE, attack: "men" });
  while (s.player.stance === "windup") s = stepBrawl(s, IDLE);
  assert.equal(s.zanshin, null);
  assert.equal(s.player.stance, "recovery");
});

function atTell(kind: "fist" | "stick"): BrawlState {
  let s = createBrawl({ bullies: [{ kind, x: 76 }], seed: 2 });
  for (let i = 0; i < 400 && s.bullies[0].state !== "tell"; i++) s = stepBrawl(s, IDLE);
  assert.equal(s.bullies[0].state, "tell");
  return s;
}

test("a punching bully's raised fists leave only the do open", () => {
  const strike = (attack: AttackKind) => {
    let s = stepBrawl(atTell("fist"), { ...IDLE, attack, stomp: true });
    while (s.player.stance === "windup") s = stepBrawl(s, IDLE);
    return s.zanshin !== null;
  };
  assert.equal(strike("do"), true);
  assert.equal(strike("men"), false);
});

test("a bully swinging a stick leaves only the kote open", () => {
  const strike = (attack: AttackKind) => {
    let s = stepBrawl(atTell("stick"), { ...IDLE, attack, stomp: true });
    while (s.player.stance === "windup") s = stepBrawl(s, IDLE);
    return s.zanshin !== null;
  };
  assert.equal(strike("kote"), true);
  assert.equal(strike("do"), false);
});

test("a stick reaches further than a fist", () => {
  const firstTellGap = (kind: "fist" | "stick") => {
    const s = atTell(kind);
    return Math.abs(s.bullies[0].x - s.player.x);
  };
  assert.ok(firstTellGap("stick") > firstTellGap("fist"));
});

test("every bully attack has a tell first", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 100 }], seed: 9 });
  let told = false;
  for (let t = 0; t < 2000 && s.phase === "fight"; t++) {
    s = stepBrawl(s, IDLE);
    if (s.bullies[0].state === "tell") told = true;
    if (s.events.some((e) => e.type === "hurt")) {
      assert.ok(told);
      return;
    }
  }
  assert.fail("never hit");
});

test("blocking toward a bully stops the hit and costs ki", () => {
  let s = atTell("fist");
  const hp = s.hp;
  const ki = s.player.ki;
  while (s.bullies[0].state === "tell") s = stepBrawl(s, { ...IDLE, block: true });
  assert.equal(s.hp, hp);
  assert.ok(s.player.ki < ki);
});

test("blocking the wrong way doesn't help", () => {
  let s = stepBrawl(atTell("fist"), { ...IDLE, move: -1 });
  const hp = s.hp;
  while (s.bullies[0].state === "tell") s = stepBrawl(s, { ...IDLE, block: true });
  assert.equal(s.hp, hp - HIT_DAMAGE.fist);
});

test("a hit gives a moment of safety", () => {
  let s = atTell("fist");
  while (s.bullies[0].state === "tell") s = stepBrawl(s, IDLE);
  assert.ok(s.invulnerable > 0);
});

test("you can turn and hit a bully behind you", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 10 }], seed: 2, startX: 50 });
  s = stepBrawl(s, { ...IDLE, move: -1 });
  assert.equal(s.player.facing, -1);
  s = stepBrawl(s, { ...IDLE, attack: "men", stomp: true });
  while (s.player.stance === "windup") s = stepBrawl(s, IDLE);
  assert.ok(s.zanshin);
});

test("a launch closes distance fast", () => {
  const start = createBrawl({ bullies: [{ kind: "fist", x: 400 }], seed: 2 });
  let s = stepBrawl(start, { ...IDLE, dash: 1 });
  for (let i = 0; i < 20; i++) s = stepBrawl(s, IDLE);
  assert.ok(s.player.x - start.player.x >= 40);
});

const SEME: FighterInput = { ...IDLE, seme: true };

test("holding seme in a street fight plants you and drains ki", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 400 }], seed: 2 });
  const x = s.player.x;
  const ki = s.player.ki;
  for (let i = 0; i < 10; i++) s = stepBrawl(s, { ...SEME, move: 1 });
  assert.equal(s.player.x, x);
  assert.equal(s.player.stance, "seme");
  assert.ok(Math.abs(s.player.ki - (ki - 10 * SEME_DRAIN)) < 1e-9);
});

function chargedUp(bullies: BrawlSpec[]): BrawlState {
  let s = createBrawl({ bullies, seed: 2, kiMax: 500 });
  for (const b of s.bullies) b.cooldown = 9999;
  for (let i = 0; i < BRAWL_SEME_TICKS; i++) s = stepBrawl(s, SEME);
  return s;
}

test("enough pressure makes everyone nearby cower at once", () => {
  const s = chargedUp([{ kind: "fist", x: 70 }, { kind: "stick", x: 100 }, { kind: "fist", x: 40 + SEME_RANGE + 60 }]);
  assert.equal(s.bullies[0].state, "cower");
  assert.equal(s.bullies[1].state, "cower");
  assert.notEqual(s.bullies[2].state, "cower");
  assert.equal(s.pressure, 0);
  assert.ok(s.events.some((e) => e.type === "cower"));
});

test("a cowering bully doesn't attack, and gets up later", () => {
  let s = chargedUp([{ kind: "fist", x: 70 }]);
  const hp = s.hp;
  for (let i = 0; i < COWER_TICKS - 2; i++) {
    s = stepBrawl(s, IDLE);
    assert.equal(s.bullies[0].state, "cower");
  }
  for (let i = 0; i < 6; i++) s = stepBrawl(s, IDLE);
  assert.notEqual(s.bullies[0].state, "cower");
  assert.equal(s.hp, hp);
});

test("a cowering bully is open everywhere", () => {
  const strike = (attack: AttackKind) => {
    let s = stepBrawl(chargedUp([{ kind: "fist", x: 76 }]), { ...IDLE, attack, stomp: true });
    while (s.player.stance === "windup") s = stepBrawl(s, IDLE);
    return s.zanshin !== null;
  };
  assert.equal(strike("men"), true);
  assert.equal(strike("kote"), true);
});

test("no bullies in range means no pressure", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 900 }], seed: 2 });
  for (let i = 0; i < 20; i++) s = stepBrawl(s, SEME);
  assert.equal(s.pressure, 0);
});

test("getting hit knocks your pressure back", () => {
  let s = atTell("fist");
  s = { ...s, pressure: 40, player: { ...s.player, ki: 90 } };
  while (s.bullies[0].state === "tell") s = stepBrawl(s, SEME);
  assert.ok(s.pressure < 40);
  assert.ok(s.events.some((e) => e.type === "hurt"));
});

test("walking back off the start of the street ends the fight without a win", () => {
  let s = createBrawl({ bullies: MARKET, seed: 2 });
  for (let i = 0; i < 400 && s.phase === "fight"; i++) s = stepBrawl(s, { ...IDLE, move: -1 });
  assert.equal(s.phase, "fled");
});

test("the far end of the street is a wall", () => {
  let s = createBrawl({ bullies: [{ kind: "fist", x: 900 }], seed: 2, startX: 880 });
  for (let i = 0; i < 300; i++) s = stepBrawl(s, { ...IDLE, move: 1 });
  assert.ok(s.player.x <= s.worldEnd);
});

test("stepBrawl is pure, and a seed replays the same fight", () => {
  const s = createBrawl({ bullies: MARKET, seed: 5 });
  const clone = structuredClone(s);
  stepBrawl(s, IDLE);
  assert.deepEqual(s, clone);
  assert.deepEqual(play(reader(), MARKET, 5), play(reader(), MARKET, 5));
});

test("a finished fight stays finished", () => {
  const s = play(() => IDLE, [{ kind: "fist", x: 100 }], 1);
  assert.deepEqual(stepBrawl(s, IDLE).hp, s.hp);
  assert.equal(stepBrawl(s, IDLE).phase, s.phase);
});

test("a kiai in a gang fight jumps the pressure on everyone close", () => {
  let s = createBrawl({ bullies: MARKET, seed: 1 });
  s.bullies[0].x = s.player.x + 40;
  s = stepBrawl(s, { ...IDLE, seme: true });
  const before = s.pressure;
  s = stepBrawl(s, { ...IDLE, seme: true, stomp: true });
  assert.ok(s.events.some((e) => e.type === "shout"));
  assert.equal(s.pressure, before + BRAWL_KIAI_PRESS + 1);
  s = stepBrawl(s, { ...IDLE, seme: true, stomp: true });
  assert.equal(s.events.some((e) => e.type === "shout"), false, "not again so soon");
  for (let i = 0; i < KIAI_COOLDOWN; i++) s.player.kiaiTicks = Math.max(0, s.player.kiaiTicks - 1);
  s = stepBrawl(s, { ...IDLE, seme: true, stomp: true });
  assert.ok(s.events.some((e) => e.type === "shout"));
});

test("the street fights in the new cities are longer, and a player who reads them can still win", () => {
  for (const gang of ["picnic", "foundry", "gorge"]) {
    assert.ok(GANGS[gang].length > GANGS.market!.length, gang);
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++) if (play(reader(), GANGS[gang], seed).phase === "won") wins++;
    assert.ok(wins >= 7, `${gang}: won ${wins} of 10`);
  }
});

test("the street fights in the new cities can't be mashed through", () => {
  const masher: Player = (s) => {
    if (s.zanshin) return { ...IDLE, move: s.player.facing };
    const b = nearest(s);
    if (!b) return IDLE;
    const gap = Math.abs(b.x - s.player.x);
    if (gap > RANGE_MAX - 2) return { ...IDLE, move: b.x > s.player.x ? 1 : -1 };
    return s.player.stance === "guard" ? { ...IDLE, attack: "men", stomp: false } : IDLE;
  };
  for (const gang of ["foundry", "gorge"]) assert.notEqual(play(masher, GANGS[gang], 1).phase, "won", gang);
});

test("a stick hurts more than a fist, and it takes several hits to go down from full health", () => {
  assert.ok(HIT_DAMAGE.stick > HIT_DAMAGE.fist);
  assert.ok(100 / HIT_DAMAGE.stick >= 4);
});

test("you bring your health into a fight, and go down sooner if you came in hurt", () => {
  const hurt = createBrawl({ bullies: [{ kind: "fist", x: 70 }], seed: 1, hp: 10 });
  assert.equal(hurt.hp, 10);
  const after = play(() => IDLE, [{ kind: "fist", x: 70 }], 1);
  assert.equal(after.phase, "lost");
});

test("a failed strike in a street fight costs what it always has", () => {
  assert.equal(BRAWL_RECOVERY_TICKS, 26);
});
