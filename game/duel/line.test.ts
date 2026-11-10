import test from "node:test";
import assert from "node:assert/strict";
import { RANGE_MAX } from "./constants.ts";
import { createLine, LINE_TIERS, linePassed, lineTierFor, stepLine, type LineState } from "./line.ts";
import { ATTACKS, type AttackKind, type FighterInput, type Target } from "./rules.ts";
import { OPENING_POSE, poseFor } from "./poses.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
type Player = (s: LineState) => FighterInput;

const canAct = (s: LineState) => s.brawl.player.stance === "guard";
const open = (s: LineState): Target | null => (s.active === null ? null : s.brawl.bullies[s.active].opening ?? null);

function play(player: Player, tier = 0, seed = 1, ticks = 7200): LineState {
  let s = createLine({ tier, seed });
  for (let t = 0; t < ticks && !s.done; t++) s = stepLine(s, player(s));
  return s;
}

/** Walks on, reads each opening and answers it with the whole combination. */
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
    if (!canAct(s)) return IDLE;
    if (waited++ < delay) return IDLE;
    const attack: AttackKind = wrong ? (target === "men" ? "kote" : "men") : target;
    return { ...IDLE, attack, stomp };
  };
};

test("a good run hits every opening cleanly and passes, at every tier", () => {
  LINE_TIERS.forEach((spec, tier) => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = play(reader(), tier, seed);
      assert.equal(s.done, true);
      assert.equal(s.results.length, spec.count);
      assert.ok(s.results.every((r) => r === "clean"), `tier ${tier} seed ${seed}: ${s.results}`);
      assert.equal(linePassed(s), true);
    }
  });
});

test("only the senpai you've reached opens up, and only once you're in range", () => {
  let s = createLine({ tier: 0, seed: 1 });
  assert.equal(open(s), null);
  for (let t = 0; t < 2000 && open(s) === null; t++) s = stepLine(s, { ...IDLE, move: 1 });
  assert.ok(s.brawl.bullies[0].x - s.brawl.player.x <= RANGE_MAX);
  assert.equal(s.brawl.bullies.filter((b) => b.opening).length, 1);
  assert.equal(s.active, 0);
});

test("standing back never fails you", () => {
  const s = play(() => IDLE, 0, 1, 2000);
  assert.equal(s.done, false);
  assert.ok(s.results.every((r) => r === null));
});

test("hitting the wrong part is a miss, and that senpai waves you on", () => {
  const s = play(reader({ wrong: true }));
  assert.ok(s.results.every((r) => r === "miss"));
  assert.equal(s.done, true);
  assert.equal(linePassed(s), false);
});

test("no fumikomi is a miss", () => {
  assert.ok(play(reader({ stomp: false })).results.every((r) => r === "miss"));
});

test("no follow-through is a miss", () => {
  const s = play(reader({ slide: false }), 0, 1, 7200);
  assert.ok(s.results.every((r) => r === "miss"), String(s.results));
});

test("waiting too long once they've opened up is a miss", () => {
  const spec = LINE_TIERS[0];
  const s = play(reader({ delay: spec.window + 5 }));
  assert.ok(s.results.every((r) => r === "miss"), String(s.results));
});

test("a late press that was started in time still counts", () => {
  const spec = LINE_TIERS[0];
  const s = play(reader({ delay: spec.window - 2 }));
  assert.ok(s.results.every((r) => r === "clean"), String(s.results));
});

test("walking straight past someone is a miss", () => {
  const s = play(() => ({ ...IDLE, move: 1 }));
  assert.equal(s.done, true);
  assert.ok(s.results.every((r) => r === "miss"), String(s.results));
});

test("swinging from out of range costs a swing, not a senpai", () => {
  let s = createLine({ tier: 0, seed: 1 });
  s = stepLine(s, { ...IDLE, attack: "men", stomp: true });
  for (let t = 0; t < 30; t++) s = stepLine(s, IDLE);
  assert.ok(s.results.every((r) => r === null));
});

test("you pass with enough clean hits, and fail with too few", () => {
  const spec = LINE_TIERS[0];
  const runWith = (cleans: number): LineState => {
    let hit = 0;
    return play((s) => {
      if (s.brawl.zanshin) return { ...IDLE, move: 1 };
      const target = open(s);
      if (!target) return { ...IDLE, move: 1 };
      if (!canAct(s)) return IDLE;
      const right = s.active !== null && hit < cleans;
      if (right && s.results[s.active!] === null) {
        hit += 1;
        return { ...IDLE, attack: target, stomp: true };
      }
      return { ...IDLE, attack: target === "men" ? "kote" : "men", stomp: true };
    });
  };
  assert.equal(linePassed(runWith(spec.need)), true);
  assert.equal(linePassed(runWith(spec.need - 1)), false);
});

test("mashing the same strike doesn't pass", () => {
  for (let tier = 0; tier < LINE_TIERS.length; tier++) {
    let passes = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = play((state) => {
        if (state.brawl.zanshin) return { ...IDLE, move: 1 };
        if (!open(state)) return { ...IDLE, move: 1 };
        return canAct(state) ? { ...IDLE, attack: "men", stomp: true } : IDLE;
      }, tier, seed);
      if (linePassed(s)) passes++;
    }
    assert.equal(passes, 0, `tier ${tier}`);
  }
});

test("every line asks for all three targets, never the same one twice running", () => {
  for (let tier = 0; tier < LINE_TIERS.length; tier++) {
    for (let seed = 1; seed <= 30; seed++) {
      const { openings } = createLine({ tier, seed });
      assert.equal(new Set(openings).size, 3, String(openings));
      for (let i = 1; i < openings.length; i++) assert.notEqual(openings[i], openings[i - 1], String(openings));
    }
  }
});

test("the tiers get harder and the last one shows no key prompts", () => {
  for (let i = 1; i < LINE_TIERS.length; i++) {
    assert.ok(LINE_TIERS[i].window < LINE_TIERS[i - 1].window);
    assert.ok(LINE_TIERS[i].need >= LINE_TIERS[i - 1].need);
  }
  assert.equal(LINE_TIERS[0].labels, true);
  assert.equal(LINE_TIERS[LINE_TIERS.length - 1].labels, false);
});

test("the tier follows how many times you've passed, and stays at the top", () => {
  assert.equal(lineTierFor(0), 0);
  assert.equal(lineTierFor(1), 1);
  assert.equal(lineTierFor(2), 2);
  assert.equal(lineTierFor(9), 2);
});

test("walking back out of the start leaves the drill", () => {
  const s = play(() => ({ ...IDLE, move: -1 }));
  assert.equal(s.left, true);
  assert.equal(s.done, true);
  assert.equal(linePassed(s), false);
});

test("nobody in the line ever hits you", () => {
  let s = createLine({ tier: 0, seed: 1 });
  for (let t = 0; t < 2000; t++) s = stepLine(s, IDLE);
  assert.equal(s.brawl.hp, createLine({ tier: 0, seed: 1 }).brawl.hp);
});

test("each opening looks the same as the duel tell that leaves that target open", () => {
  for (const target of ["men", "kote", "do"] as Target[]) {
    const attacks = (Object.keys(ATTACKS) as AttackKind[]).filter((a) => ATTACKS[a].exposes === target);
    assert.ok(attacks.length > 0);
    for (const attack of attacks) {
      const pose = poseFor({ stance: "windup", attack, launchTicks: 0 }, { phase: "fight", striking: null, scored: false });
      assert.equal(OPENING_POSE[target], pose, `${target} via ${attack}`);
    }
  }
});

test("stepLine doesn't change the state it was given", () => {
  const s = createLine({ tier: 0, seed: 1 });
  const before = structuredClone(s);
  stepLine(s, { ...IDLE, move: 1 });
  assert.deepEqual(s, before);
});

test("holding D while you read the opening stops you at striking distance, so a slow read isn't a lock", () => {
  // Still walking, and well over half a second to react: it's the window that decides, not how close you've drifted.
  let waited = 0;
  const slowWalker: Player = (s) => {
    const target = open(s);
    if (!target || s.brawl.zanshin || !canAct(s)) {
      if (!target) waited = 0;
      return { ...IDLE, move: 1 };
    }
    return waited++ < 45 ? { ...IDLE, move: 1 } : { ...IDLE, move: 1, attack: target, stomp: true };
  };
  for (let tier = 0; tier < LINE_TIERS.length; tier++) {
    const s = play(slowWalker, tier, 3);
    assert.ok(s.results.every((r) => r === "clean"), `tier ${tier}: ${s.results}`);
  }
});

test("every miss is announced, whatever caused it", () => {
  for (const player of [() => ({ ...IDLE, move: 1 as const }), reader({ wrong: true }), reader({ stomp: false }), reader({ slide: false })]) {
    let s = createLine({ tier: 0, seed: 1 });
    let missed = 0;
    for (let t = 0; t < 7200 && !s.done; t++) {
      s = stepLine(s, player(s));
      missed += s.notes.filter((n) => n === "missed").length;
    }
    assert.equal(missed, s.results.filter((r) => r === "miss").length);
    assert.ok(missed > 0);
  }
});
