import test from "node:test";
import { directDuel as createDuel } from "./test-support.ts";
import assert from "node:assert/strict";
import { RANGE_MAX, RANGE_MIN, RECOVERY_TICKS } from "./constants.ts";
import { counterPrompt } from "./hud.ts";
import { createRival, rivalAct } from "./rival.ts";
import { ATTACKS, distance, exposedTargets, exposes, KAMAE, skipBow, step, type AttackKind, type DuelState, type Fighter, type FighterInput, type Target, type Kamae } from "./rules.ts";
import { tipFor } from "./tips.ts";
import { createRunState, duelOptionsFor, rivalConfigFor, type RunState } from "../run-state.ts";
import { MEMBERS, type OpponentId } from "../world/dojos.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const fighter = (kamae: Kamae, over: Partial<Fighter> = {}): Fighter => ({ ...createDuel().fighters[0], kamae, ...over });

test("chudan is what everyone's used to: guard leaves everything open", () => {
  assert.deepEqual(exposedTargets(fighter("chudan")), ["men", "kote", "do"]);
  assert.deepEqual(createDuel().fighters.map((f) => f.kamae), ["chudan", "chudan"]);
});

test("a jodan guard keeps the men out of reach", () => {
  assert.deepEqual(exposedTargets(fighter("jodan")), ["kote", "do"]);
});

test("two swords cover the men in guard, and everything but the do after a miss", () => {
  assert.deepEqual(exposedTargets(fighter("nito")), ["kote", "do"]);
  assert.deepEqual(exposedTargets(fighter("nito", { stance: "recovery" })), ["do"]);
  assert.deepEqual(exposedTargets(fighter("jodan", { stance: "recovery" })), ["men", "kote", "do"]);
});

test("the tells point somewhere new, and the prompts and the rules agree on where", () => {
  assert.equal(exposes("men", "chudan"), ATTACKS.men.exposes);
  assert.equal(exposes("men", "jodan"), "kote");
  assert.equal(exposes("kote", "jodan"), "do");
  assert.equal(exposes("men", "nito"), "do");
  assert.equal(exposes("kote", "nito"), "do");
  for (const kamae of ["chudan", "jodan", "nito"] as Kamae[]) {
    for (const attack of ["men", "kote", "bigMen"] as AttackKind[]) {
      assert.deepEqual(exposedTargets(fighter(kamae, { stance: "windup", attack })), [exposes(attack, kamae)]);
      assert.ok(counterPrompt(attack, kamae).endsWith(exposes(attack, kamae)));
    }
  }
});

const strikeFrom = (dist: number, kamae: Kamae): DuelState => {
  let duel = skipBow(createDuel({ kamae: ["chudan", kamae] }));
  duel.fighters[1].x = duel.fighters[0].x + dist;
  duel = step(duel, IDLE, { ...IDLE, attack: "men" });
  for (let t = 0; t < 40 && duel.phase === "fight" && duel.fighters[1].stance === "windup"; t++) {
    duel = step(duel, IDLE, { ...IDLE, stomp: duel.fighters[1].stanceTicks <= 3 });
  }
  return duel;
};

test("jodan reaches further than anyone else, so the usual safe distance isn't safe", () => {
  const dist = RANGE_MAX + KAMAE.jodan.reach - 1;
  assert.ok(dist > RANGE_MAX);
  assert.equal(strikeFrom(dist, "jodan").phase, "zanshin");
  assert.equal(strikeFrom(dist, "chudan").phase, "fight");
  assert.equal(strikeFrom(RANGE_MAX + KAMAE.jodan.reach + 1, "jodan").phase, "fight");
});

test("a jodan miss leaves them hanging for longer", () => {
  const missed = strikeFrom(RANGE_MAX + KAMAE.jodan.reach + 1, "jodan").fighters[1];
  assert.equal(missed.stance, "recovery");
  assert.equal(missed.stanceTicks, RECOVERY_TICKS + KAMAE.jodan.extraRecovery);
  assert.equal(strikeFrom(RANGE_MAX + 1, "chudan").fighters[1].stanceTicks, RECOVERY_TICKS);
});

test("two swords soak up blocked strikes for half the ki", () => {
  const blockedKi = (kamae: Kamae) => {
    let duel = skipBow(createDuel({ kamae: ["chudan", kamae], steadyGuard: [false, true] }));
    duel.fighters[1].x = duel.fighters[0].x + 30;
    const before = duel.fighters[1].ki;
    duel = step(duel, { ...IDLE, attack: "men" }, { ...IDLE, block: true });
    for (let t = 0; t < 20 && duel.fighters[0].stance === "windup"; t++) duel = step(duel, IDLE, { ...IDLE, block: true });
    return before - duel.fighters[1].ki;
  };
  assert.equal(blockedKi("nito"), blockedKi("chudan") / 2);
});

test("the tips explain the stance you just lost to", () => {
  assert.match(tipFor({ by: 1, attack: "men", defenderStance: "guard" }, false, "jodan"), /jodan|reach|further/i);
  assert.match(tipFor({ by: 1, attack: "men", defenderStance: "guard" }, false, "nito"), /do/);
});

const MATCHES = 20;
const MAX_TICKS = 7200;
type Player = (duel: DuelState) => FighterInput;

function winsAgainst(id: OpponentId, player: () => Player, run: RunState = createRunState()): number {
  let won = 0;
  for (let seed = 1; seed <= MATCHES; seed++) {
    const me = player();
    let duel = skipBow(createDuel({ ...duelOptionsFor(run, id), direct: [false, false] }));
    let rival = createRival(seed, rivalConfigFor(run, id));
    for (let t = 0; t < MAX_TICKS && duel.phase !== "over"; t++) {
      const act = rivalAct(duel, rival);
      rival = act.rival;
      let input = me(duel);
      if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: 1 };
      if (input.attack && !duel.lock && duel.fighters[0].counterTicks === 0) input = { ...input, opening: "wrist" };
      duel = step(duel, input, act.input);
    }
    if (duel.winner === 0) won++;
  }
  return won;
}

const masher = (): Player => {
  let n = 0;
  const cycle: AttackKind[] = ["men", "kote", "do"];
  return (duel) => (distance(duel) > RANGE_MAX - 2 ? { ...IDLE, move: 1 } : { ...IDLE, attack: cycle[n++ % 3], stomp: true });
};

/** Sees the tell after a human-like delay and answers it with whatever it leaves open, otherwise holds block. */
const reader = (read: (open: Target) => AttackKind | null, reaction = 14): Player => {
  let watching: Target | null = null;
  let seenFor = 0;
  return (duel) => {
    const them = duel.fighters[1];
    const dist = distance(duel);
    const tell = them.stance === "windup" || them.stance === "opening" ? exposedTargets(them)[0] : null;
    if (tell !== watching) {
      watching = tell;
      seenFor = 0;
    } else if (tell) seenFor++;
    if (dist > RANGE_MAX - 2) return { ...IDLE, move: 1 };
    if (dist < RANGE_MIN + 4) return { ...IDLE, move: -1 };
    if (tell && seenFor >= reaction) {
      const answer = read(tell);
      if (answer) return { ...IDLE, attack: answer, stomp: true };
    }
    if (them.stance === "recovery" && them.stanceTicks > 14) return { ...IDLE, attack: exposedTargets(them)[0] === "men" ? "kote" : exposedTargets(them)[0], stomp: true };
    return { ...IDLE, block: true };
  };
};
const knowsTheStance = () => reader((open) => open);
/** Plays Shin as if they were anyone else: answering with the usual counters, and hitting kote after a miss. */
const oneSwordHabits = (): Player => {
  const usual = reader((open) => (open === "do" ? "kote" : open));
  return (duel) => {
    const input = usual(duel);
    return input.attack === "do" && duel.fighters[1].stance === "recovery" ? { ...input, attack: "kote" } : input;
  };
};

for (const id of ["tetsu", "shin"] as const) {
  test(`${id}: can't be beaten by standing there, mashing or holding block`, () => {
    assert.equal(winsAgainst(id, () => () => IDLE), 0);
    assert.ok(winsAgainst(id, masher) <= 4, "mashing");
    assert.equal(winsAgainst(id, () => () => ({ ...IDLE, block: true })), 0);
  });
  test(`${id}: reading their stance wins most matches`, () => {
    const won = winsAgainst(id, knowsTheStance);
    assert.ok(won >= 12, `won ${won} of ${MATCHES}`);
  });
}

test("Shin punishes anyone who still fights them as if they had one sword", () => {
  assert.equal(winsAgainst("shin", oneSwordHabits), 0);
});

test("the people who fight in these stances really do", () => {
  assert.equal(MEMBERS.tetsu.kamae, "jodan");
  assert.equal(MEMBERS.shin.kamae, "nito");
  assert.deepEqual(duelOptionsFor(createRunState(), "tetsu").kamae, ["chudan", "jodan"]);
  assert.equal(duelOptionsFor(createRunState(), "aki").kamae, undefined);
});

test("a rival in jodan keeps their own, longer distance", () => {
  const run = createRunState();
  let duel = skipBow(createDuel(duelOptionsFor(run, "tetsu")));
  let rival = createRival(1, rivalConfigFor(run, "tetsu"));
  let closest = Infinity;
  for (let t = 0; t < 400; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    duel = step(duel, IDLE, act.input);
    if (duel.phase !== "fight") break;
    closest = Math.min(closest, distance(duel));
  }
  assert.ok(closest > RANGE_MAX, `stopped at ${closest}`);
});
