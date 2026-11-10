import test from "node:test";
import assert from "node:assert/strict";
import { ATTACKS, createDuel, distance, exposedTargets, skipBow, step as rawStep, type AttackKind, type DuelState, type Fighter, type FighterInput } from "./rules.ts";
import { createRival, rivalAct, rivalConfig, withMood } from "./rival.ts";
import { RANGE_MAX, RANGE_MIN, HIKI_TELL } from "./constants.ts";
import { createRunState, duelOptionsFor, recordLoss, rivalConfigFor } from "../run-state.ts";
import type { SenpaiId } from "../scenes/curriculum.ts";
import type { NodeId } from "../world/map.ts";
import { moodOf } from "./rival.ts";

/** Everyone here strikes the only way a player can: from an opening. Which one doesn't matter to these tests, and the strike's queued for the shortest time the rules allow. */
const step = (duel: DuelState, a: FighterInput, b: FighterInput) => rawStep(duel, a.attack && !duel.lock && !a.opening && duel.fighters[0].counterTicks === 0 ? { ...a, opening: "wrist" } : a, b);

const MATCHES = 20;
const MAX_TICKS = 7200;
const IDLE: FighterInput = { move: 0, block: false, attack: null };

type Player = (duel: DuelState) => FighterInput;

type Result = { winner: 0 | 1 | null; broke: boolean; rivalAttacks: { kind: AttackKind; defender: Fighter["stance"] }[] };

function play(player: Player, seed: number, losses = 0, followThrough = true, node: NodeId = "radish"): Result {
  let run = { ...createRunState(), node };
  for (let i = 0; i < losses; i++) run = recordLoss(run);
  let duel = skipBow(createDuel(duelOptionsFor(run)));
  let rival = createRival(seed, rivalConfigFor(run));
  let broke = false;
  const rivalAttacks: Result["rivalAttacks"] = [];
  for (let t = 0; t < MAX_TICKS && duel.phase !== "over"; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    const canAttack = duel.fighters[1].stance === "guard" || duel.fighters[1].stance === "block" || duel.fighters[1].stance === "opening";
    if (act.input.attack && canAttack && duel.phase === "fight") {
      rivalAttacks.push({ kind: act.input.attack, defender: duel.fighters[0].stance });
    }
    let input = player(duel);
    if (duel.phase === "zanshin" && duel.zanshin?.by === 0 && followThrough) input = { ...input, move: 1 };
    duel = step(duel, input, act.input);
    if (duel.events.some((e) => e.type === "broken" && e.by === 0)) broke = true;
  }
  return { winner: duel.winner, broke, rivalAttacks };
}

const wins = (player: () => Player, losses = 0) => {
  let count = 0;
  for (let seed = 1; seed <= MATCHES; seed++) if (play(player(), seed, losses).winner === 0) count++;
  return count;
};

/** Walks toward the rival, then cycles strikes as soon as it's allowed to. */
const masher = (): Player => {
  let n = 0;
  const cycle: AttackKind[] = ["men", "kote", "do"];
  return (duel) => {
    if (distance(duel) > RANGE_MAX - 2) return { move: 1, block: false, attack: null };
    return { move: 0, block: false, attack: cycle[n++ % 3], stomp: true };
  };
};

/** Reacts to the rival's tell after a human-like delay with the right counter, otherwise holds block. */
const tellReader = (reactionTicks = 18): Player => {
  let watching: string | null = null;
  let seenFor = 0;
  return (duel) => {
    const rival = duel.fighters[1];
    const dist = distance(duel);
    const tell = rival.stance === "windup" || rival.stance === "opening" ? exposedTargets(rival)[0] : null;
    if (tell !== watching) {
      watching = tell;
      seenFor = 0;
    } else if (tell) {
      seenFor++;
    }
    if (dist > RANGE_MAX - 2) return { move: 1, block: false, attack: null };
    if (dist < RANGE_MIN + 4) return { move: -1, block: false, attack: null };
    // Blocking and opening both cost ki, so anyone sensible catches their breath between attacks.
    if (duel.fighters[0].ki < 70 && !tell) return IDLE;
    if (tell && seenFor >= reactionTicks) return { move: 0, block: false, attack: tell as AttackKind, stomp: true };
    if (rival.stance === "recovery" || rival.stance === "broken") {
      if (seenFor >= 0 && rival.stanceTicks > 8) return { move: 0, block: false, attack: "men", stomp: true };
    }
    return { move: 0, block: true, attack: null };
  };
};

test("an idle player loses every match", () => {
  for (let seed = 1; seed <= MATCHES; seed++) assert.equal(play(() => IDLE, seed).winner, 1, `seed ${seed}`);
});

test("mashing strikes wins at most 2 of 20", () => {
  const count = wins(masher);
  assert.ok(count <= 2, `masher won ${count} of ${MATCHES}`);
});

test("holding block wins 0 of 20 and the guard breaks at least once", () => {
  const block: Player = () => ({ move: 0, block: true, attack: null });
  for (let seed = 1; seed <= MATCHES; seed++) {
    const result = play(block, seed, 0, true, "heron");
    assert.equal(result.winner, 1, `seed ${seed} ended ${result.winner}`);
    assert.equal(result.broke, true, `seed ${seed} never broke`);
  }
});

test("reading tells beats a normal rival, but it isn't enough against Ren, who wants seme too", () => {
  const heron = winsAt(() => tellReader(), "heron");
  const radish = winsAt(() => tellReader(), "radish");
  assert.ok(heron >= 12, `heron ${heron}`);
  assert.ok(radish <= 8 && radish < heron, `radish ${radish}`);
});

test("reading every tell but never stomping can't score", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const reader = tellReader();
    const noStomp: Player = (duel) => ({ ...reader(duel), stomp: false });
    assert.notEqual(play(noStomp, seed).winner, 0, `seed ${seed}`);
  }
});

test("reading every tell but never following through can't score", () => {
  for (let seed = 1; seed <= 6; seed++) assert.notEqual(play(tellReader(), seed, 0, false).winner, 0, `seed ${seed}`);
});

test("Ren stomps and follows through, so Ren's strikes can score", () => {
  assert.equal(play(() => IDLE, 1).winner, 1);
});

test("just powering up every chance you get doesn't beat Ren", () => {
  const charger: Player = (duel) => {
    const [me, ren] = duel.fighters;
    if (duel.phase !== "fight") return IDLE;
    if (distance(duel) > RANGE_MAX - 4) return { ...IDLE, move: 1 };
    if (ren.stance === "shaken" && me.stance !== "windup") return { ...IDLE, attack: "men", stomp: true };
    return { ...IDLE, seme: true };
  };
  const count = wins(() => charger);
  assert.ok(count <= 6, `charger won ${count} of ${MATCHES}`);
});

test("Ren punishes a flinching player with the quick strike", () => {
  const duel = skipBow(createDuel());
  duel.fighters[0].stance = "shaken";
  duel.fighters[0].stanceTicks = 40;
  duel.fighters[0].x = duel.fighters[1].x - 40;
  let rival = createRival(3, rivalConfig(0));
  let attacked: AttackKind | null = null;
  for (let i = 0; i < 12 && !attacked; i++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    attacked = act.input.attack;
  }
  assert.equal(attacked, "quickMen");
});

test("a slow reader does better once the rival has eased off", () => {
  // Too slow to be caught up in the swing with them, so these are simply hit. Any later and they couldn't read it at all.
  const atFull = winsAt(() => tellReader(48), "heron");
  const eased = winsAt(() => tellReader(48), "heron", 4);
  assert.ok(eased > atFull, `eased ${eased}, full ${atFull}`);
});

test("rival uses quickMen only against someone caught out of position or already swinging; every other attack has its full tell", () => {
  let sawPunish = false;
  let sawHabit = false;
  for (let seed = 1; seed <= MATCHES; seed++) {
    for (const { kind, defender } of [...play(masher(), seed).rivalAttacks, ...play(tellReader(), seed).rivalAttacks]) {
      if (kind === "quickMen") {
        sawPunish = true;
        assert.ok(defender === "recovery" || defender === "broken" || defender === "shaken" || defender === "deflected" || defender === "stumble" || defender === "windup", `punished a ${defender} opponent`);
      } else {
        sawHabit = true;
        assert.ok(["men", "kote", "bigMen"].includes(kind), `unexpected rival attack ${kind}`);
      }
    }
  }
  assert.ok(sawPunish && sawHabit);
});

test("the punish lands before the opponent's recovery ends", () => {
  assert.ok(6 + ATTACKS.quickMen.windup < 26);
});

test("rival tells grow +4 per loss and cap at +16", () => {
  assert.deepEqual(rivalConfig(0).tell, { men: 38, kote: 38, bigMen: 58 });
  assert.deepEqual(rivalConfig(1).tell, { men: 42, kote: 42, bigMen: 62 });
  assert.deepEqual(rivalConfig(4).tell, { men: 54, kote: 54, bigMen: 74 });
  assert.deepEqual(rivalConfig(50).tell, rivalConfig(4).tell);
});

test("same seed gives the same match", () => {
  assert.deepEqual(play(masher(), 7), play(masher(), 7));
});

test("different seeds give different habits", () => {
  // At Iron Heron, since Ren's stare folds someone standing idle before Ren's habits ever come into it.
  const order = (seed: number) => play(() => IDLE, seed, 0, true, "heron").rivalAttacks.map((a) => a.kind).join();
  assert.ok(new Set([1, 2, 3, 4, 5, 6].map(order)).size > 1);
});

test("rivalAct is pure", () => {
  const duel = skipBow(createDuel());
  const rival = createRival(3, rivalConfig(0));
  const clone = structuredClone(rival);
  rivalAct(duel, rival);
  assert.deepEqual(rival, clone);
});

const winsAtGoose = (player: () => Player) => {
  let count = 0;
  for (let seed = 1; seed <= MATCHES; seed++) if (play(player(), seed, 0, true, "goose").winner === 0) count++;
  return count;
};

const attacksIn = (node: NodeId) => {
  const attacks: AttackKind[] = [];
  for (let seed = 1; seed <= MATCHES; seed++) {
    const block: Player = () => ({ move: 0, block: true, attack: null });
    attacks.push(...play(block, seed, 0, true, node).rivalAttacks.map((a) => a.kind));
  }
  return attacks;
};

test("an idle player loses every match against Hana", () => {
  for (let seed = 1; seed <= MATCHES; seed++) assert.equal(play(() => IDLE, seed, 0, true, "goose").winner, 1, `seed ${seed}`);
});

test("mashing strikes doesn't beat Hana either", () => {
  const count = winsAtGoose(masher);
  assert.ok(count <= 4, `masher won ${count} of ${MATCHES}`);
});

test("holding block doesn't beat Hana", () => {
  const block: Player = () => ({ move: 0, block: true, attack: null });
  assert.equal(winsAtGoose(() => block), 0);
});

test("reading Hana's tells still wins most matches", () => {
  const count = winsAtGoose(() => tellReader());
  assert.ok(count >= 14, `tell reader won ${count} of ${MATCHES}`);
});

test("Hana attacks more readily than Ren, and favours the big swing", () => {
  const measure = (config: ReturnType<typeof rivalConfig>) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (let seed = 1; seed <= MATCHES; seed++) {
      const duel = skipBow(createDuel());
      duel.fighters[0].x = duel.fighters[1].x - 40;
      let rival = createRival(seed, config);
      for (let t = 0; t < 1200; t++) {
        const act = rivalAct(duel, rival);
        // Between attacks the duel stands still, so this measures only the rival's choices.
        rival = act.rival;
        // Standing still, nothing ever gets past the opening, so this counts what they meant to do.
        if (act.rival.plan) {
          counts[act.rival.plan.attack] = (counts[act.rival.plan.attack] ?? 0) + 1;
          total++;
        }
      }
    }
    return { counts, total };
  };
  const ren = measure(rivalConfig(0));
  const hana = measure(rivalConfig(0, "fierce"));
  assert.ok(hana.total > ren.total * 1.4, `Hana ${hana.total}, Ren ${ren.total}`);
  assert.ok(hana.counts.bigMen > hana.counts.men && hana.counts.bigMen > hana.counts.kote);
});

test("every Hana attack still has its full tell", () => {
  const seen = new Set(attacksIn("goose"));
  assert.ok(seen.has("bigMen"));
  const { tell } = rivalConfig(0, "fierce");
  assert.ok(tell.men >= 26 && tell.kote >= 26 && tell.bigMen >= 40, JSON.stringify(tell));
});

test("Hana's tells ease off after a loss, just like Ren's", () => {
  assert.equal(rivalConfig(1, "fierce").tell.men, rivalConfig(0, "fierce").tell.men + 4);
});

const MOMO_MATCHES = 20;
function playMomo(player: Player, seed: number, kiBonus = 0): { winner: 0 | 1 | null; myPoints: number } {
  const run = { ...createRunState(), node: "pinecone" as NodeId, bonusKi: kiBonus };
  let duel = skipBow(createDuel(duelOptionsFor(run)));
  let rival = createRival(seed, rivalConfigFor(run));
  let myPoints = 0;
  for (let t = 0; t < 5400 && duel.phase !== "over"; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    let input = player(duel);
    if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: 1 };
    duel = step(duel, input, act.input);
    myPoints = duel.fighters[0].points;
  }
  return { winner: duel.winner, myPoints };
}

const launcher = (): Player => {
  let cooldown = 0;
  return (duel) => {
    if (duel.fighters[0].stance !== "guard") return IDLE;
    if (distance(duel) > RANGE_MAX + 4 && cooldown-- <= 0) { cooldown = 30; return { ...IDLE, dash: 1 }; }
    if (distance(duel) <= RANGE_MAX) return { ...IDLE, attack: "men", stomp: true };
    return { ...IDLE, move: -1 };
  };
};

const noSemeBots: [string, () => Player][] = [
  ["idle", () => () => IDLE],
  ["masher", masher],
  ["tell reader", () => tellReader()],
  ["launcher", launcher],
  ["blocker", () => () => ({ ...IDLE, block: true })],
  ["runner", () => () => ({ ...IDLE, move: -1 })],
];

for (const [name, bot] of noSemeBots) {
  test(`Momo can't be scored on without seme: ${name}`, () => {
    for (let seed = 1; seed <= MOMO_MATCHES; seed++) {
      const result = playMomo(bot(), seed, 90);
      assert.equal(result.myPoints, 0, `seed ${seed}`);
      assert.equal(result.winner, 1, `seed ${seed}`);
    }
  });
}

test("Momo finishes a player without seme quickly", () => {
  const run = { ...createRunState(), node: "pinecone" as NodeId };
  let duel = skipBow(createDuel(duelOptionsFor(run)));
  let rival = createRival(1, rivalConfigFor(run));
  const walkIn: Player = (d) => (distance(d) > 42 ? { ...IDLE, move: 1 } : IDLE);
  let t = 0;
  for (; t < 1800 && duel.fighters[1].points < 1; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    duel = step(duel, walkIn(duel), act.input);
  }
  assert.ok(t < 300, `first point took ${t} ticks`);
});

/** Holds seme, punishes the flinch, and counters the big swing it draws out. */
const semeUser = (): Player => (duel) => {
  const [me, momo] = duel.fighters;
  if (duel.phase !== "fight") return IDLE;
  if (distance(duel) > 44) return { ...IDLE, move: 1 };
  if (me.stance === "windup" || me.stance === "recovery" || me.stance === "shaken") return IDLE;
  if (momo.stance === "shaken") return { ...IDLE, attack: "men", stomp: true };
  if (momo.stance === "opening" && momo.opening === "raise" && momo.queued === null) return { ...IDLE, attack: "do", stomp: true };
  return { ...IDLE, seme: true };
};

test("with seme, Momo can be beaten", () => {
  let count = 0;
  for (let seed = 1; seed <= MOMO_MATCHES; seed++) if (playMomo(semeUser(), seed).winner === 0) count++;
  assert.ok(count >= 15, `seme user won ${count} of ${MOMO_MATCHES}`);
});

test("holding seme alone doesn't beat Momo: the big swing still has to be answered", () => {
  const hold: Player = (duel) => (distance(duel) > 44 ? { ...IDLE, move: 1 } : { ...IDLE, seme: true });
  let count = 0;
  for (let seed = 1; seed <= MOMO_MATCHES; seed++) if (playMomo(hold, seed).winner === 0) count++;
  assert.equal(count, 0);
});

test("Momo has a big ki advantage", () => {
  const options = duelOptionsFor({ ...createRunState(), node: "pinecone" });
  assert.ok(options.kiMax![1] >= 2 * options.kiMax![0]);
});

test("the other rivals don't have Momo's presence", () => {
  for (const node of ["goose", "raccoon", "heron", "otter"] as const) assert.equal(duelOptionsFor({ ...createRunState(), node }).presence, undefined);
});

// The senpai you spar with to earn the front door.
const SENPAI: SenpaiId[] = ["aki", "bo", "yui"];

function spar(player: Player, seed: number, against: SenpaiId): Result {
  const run = createRunState();
  let duel = skipBow(createDuel(duelOptionsFor(run, against)));
  let rival = createRival(seed, rivalConfigFor(run, against));
  const rivalAttacks: Result["rivalAttacks"] = [];
  for (let t = 0; t < MAX_TICKS && duel.phase !== "over"; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    let input = player(duel);
    if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: 1 };
    duel = step(duel, input, act.input);
  }
  return { winner: duel.winner, broke: false, rivalAttacks };
}
const sparWins = (player: () => Player, against: SenpaiId) => {
  let count = 0;
  for (let seed = 1; seed <= MATCHES; seed++) if (spar(player(), seed, against).winner === 0) count++;
  return count;
};

for (const against of SENPAI) {
  test(`${against}: an idle player loses`, () => {
    assert.equal(sparWins(() => () => IDLE, against), 0);
  });
  test(`${against}: mashing rarely wins`, () => {
    assert.ok(sparWins(masher, against) <= 4);
  });
  test(`${against}: holding block doesn't win`, () => {
    assert.equal(sparWins(() => () => ({ ...IDLE, block: true }), against), 0);
  });
  test(`${against}: reading tells wins nearly always`, () => {
    assert.ok(sparWins(() => tellReader(), against) >= 18);
  });
  test(`${against}: can be beaten by someone who takes over half a second to react`, () => {
    assert.ok(sparWins(() => tellReader(36), against) >= 15);
  });
}

test("each senpai fights differently", () => {
  const tells = SENPAI.map((id) => JSON.stringify(rivalConfigFor(createRunState(), id)));
  assert.equal(new Set(tells).size, SENPAI.length);
});

// The rival dojos.
const NEW_RIVALS: NodeId[] = ["raccoon", "heron", "otter"];
const winsAt = (bot: () => Player, node: NodeId, losses = 0) => {
  let count = 0;
  for (let seed = 1; seed <= MATCHES; seed++) if (play(bot(), seed, losses, true, node).winner === 0) count++;
  return count;
};

for (const node of NEW_RIVALS) {
  test(`${node}: an idle player loses`, () => assert.equal(winsAt(() => () => IDLE, node), 0));
  test(`${node}: mashing rarely wins`, () => assert.ok(winsAt(masher, node) <= 4));
  test(`${node}: holding block doesn't win`, () => assert.equal(winsAt(() => () => ({ ...IDLE, block: true }), node), 0));
  // Some answers now end in a crossing rather than a point, so it's not as many as it was, but it's still most.
  // Kenji's the hardest of these, at about 56% over hundreds of matches, so anything above half out of 20 is the honest floor.
  test(`${node}: reading tells wins most matches`, () => { const wins = winsAt(() => tellReader(), node); assert.ok(wins >= 11, `${wins} of 20`); });
}

test("each rival fights in their own way", () => {
  const styles = (["radish", "goose", ...NEW_RIVALS] as NodeId[]).map((node) => JSON.stringify(rivalConfigFor({ ...createRunState(), node })));
  assert.equal(new Set(styles).size, 5);
});

test("every rival's attacks keep their full tell, so losses can always be learned from", () => {
  for (const node of NEW_RIVALS) {
    const { tell } = rivalConfigFor({ ...createRunState(), node });
    for (const [kind, ticks] of Object.entries(tell)) assert.ok(ticks >= 24, `${node} ${kind}`);
  }
});

test("Sora is the gentlest rival, and the first you can reach", () => {
  const avg = (node: NodeId) => {
    const { tell } = rivalConfigFor({ ...createRunState(), node });
    return (tell.men + tell.kote) / 2;
  };
  for (const node of ["goose", "heron", "otter", "radish"] as NodeId[]) assert.ok(avg("raccoon") > avg(node), node);
});

// Ren, the final boss.
/** Reads tells, and breaks off to hold seme whenever Ren's aura gets too close to a flinch. */
const semeReader = (): Player => {
  const read = tellReader();
  let holding = false;
  return (duel) => {
    const [me, ren] = duel.fighters;
    // Opening takes time now, so a careful player breaks off a little sooner.
    if (me.pressure > 70) holding = true;
    if (me.pressure < 20 || ren.stance === "windup" || ren.stance === "opening") holding = false;
    if (holding && duel.phase === "fight" && (me.stance === "guard" || me.stance === "block" || me.stance === "seme")) return { ...IDLE, seme: true };
    return read(duel);
  };
};

test("Ren: an idle player loses every match", () => assert.equal(winsAt(() => () => IDLE, "radish"), 0));
test("Ren: mashing rarely wins", () => assert.ok(winsAt(masher, "radish") <= 2));
test("Ren: holding block doesn't win", () => assert.equal(winsAt(() => () => ({ ...IDLE, block: true }), "radish"), 0));
test("Ren: someone who reads tells and uses seme wins most matches", () => {
  const won = winsAt(semeReader, "radish");
  assert.ok(won >= 14, `won ${won} of ${MATCHES}`);
});
test("Ren: seme helps more against Ren than doing without it", () => {
  assert.ok(winsAt(semeReader, "radish") >= winsAt(() => tellReader(), "radish"));
});
/** Blocks everything and only punishes recoveries, ignoring anything else Ren does. */
const hider = (): Player => (duel) => {
  const ren = duel.fighters[1];
  if (distance(duel) > RANGE_MAX - 2) return { ...IDLE, move: 1 };
  if ((ren.stance === "recovery" || ren.stance === "broken") && ren.stanceTicks > 8) return { ...IDLE, attack: "men", stomp: true };
  return { ...IDLE, block: true };
};
/** The same, but it sees Ren's seme for the opening it is. */
const attentive = (): Player => {
  const hide = hider();
  return (duel) => {
    const [me, ren] = duel.fighters;
    if (ren.stance === "seme" && me.stance !== "windup" && me.stance !== "recovery" && me.stance !== "shaken" && distance(duel) <= RANGE_MAX) return { ...IDLE, attack: "men", stomp: true };
    return hide(duel);
  };
};
test("Ren: hiding behind your guard stops working", () => {
  assert.ok(winsAt(hider, "radish") <= 6, `won ${winsAt(hider, "radish")}`);
  assert.ok(winsAt(hider, "goose") > winsAt(hider, "radish"));
});
/** The least ki anyone can face Ren with, since that's what opens the door. */
const REN_DOOR_BONUS_KI = 130;
const hidingWinsAtTheDoor = (gaze: boolean) => {
  const run = { ...createRunState(), node: "radish" as NodeId, gaze, seme: true, bonusKi: REN_DOOR_BONUS_KI };
  let count = 0;
  for (let seed = 1; seed <= MATCHES; seed++) {
    const player = hider();
    let duel = skipBow(createDuel(duelOptionsFor(run)));
    let rival = createRival(seed, rivalConfigFor(run));
    for (let t = 0; t < MAX_TICKS && duel.phase !== "over"; t++) {
      const act = rivalAct(duel, rival);
      rival = act.rival;
      let input = player(duel);
      if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: 1 };
      duel = step(duel, input, act.input);
    }
    if (duel.winner === 0) count++;
  }
  return count;
};
test("Ren: hiding doesn't work at the ki you'd really face Ren with, gaze or no gaze", () => {
  assert.ok(hidingWinsAtTheDoor(false) <= 6, `won ${hidingWinsAtTheDoor(false)}`);
  assert.ok(hidingWinsAtTheDoor(true) <= 6, `with the gaze, won ${hidingWinsAtTheDoor(true)}`);
});
test("Ren: pressing a hider leaves Ren open, for anyone who's watching", () => {
  assert.ok(winsAt(attentive, "radish") > winsAt(hider, "radish"));
});
test("Ren never presses someone who isn't hiding", () => {
  const run = { ...createRunState(), node: "radish" as NodeId };
  let duel = skipBow(createDuel(duelOptionsFor(run)));
  let rival = createRival(1, rivalConfigFor(run));
  for (let t = 0; t < 600 && duel.phase === "fight"; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    assert.notEqual(act.input.seme, true);
    duel = step(duel, IDLE, act.input);
  }
});

test("Ren: after three losses the aura and the pressing go, so anyone who keeps trying gets a fair shot", () => {
  const run = (losses: number) => {
    let r = { ...createRunState(), node: "radish" as NodeId };
    for (let i = 0; i < losses; i++) r = recordLoss(r);
    return r;
  };
  assert.ok(duelOptionsFor(run(2)).presence);
  assert.equal(rivalConfigFor(run(2)).pressesGuard, true);
  assert.equal(duelOptionsFor(run(3)).presence, undefined);
  assert.equal(rivalConfigFor(run(3)).pressesGuard, false);
  assert.ok(winsAt(() => tellReader(), "radish", 3) >= 15, "reading tells is enough by then");
});

test("Ren: a tournament final doesn't ease off, however often you've lost", () => {
  let r = { ...createRunState(), node: "radish" as NodeId };
  for (let i = 0; i < 9; i++) r = recordLoss(r);
  assert.ok(duelOptionsFor(r, null, true).presence);
  assert.equal(rivalConfigFor(r, null, true).pressesGuard, true);
});

test("Momo's aura never eases off: that's what makes the fight rigged", () => {
  let r = { ...createRunState(), node: "pinecone" as NodeId };
  for (let i = 0; i < 9; i++) r = recordLoss(r);
  assert.ok(duelOptionsFor(r).presence);
});

test("a rival's mood changes when and what they swing, and never how long their tells last", () => {
  const base = rivalConfig(0, "steady");
  const moods = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => withMood(base, seed));
  assert.ok(new Set(moods.map((m) => m.habitMin)).size > 2);
  assert.ok(new Set(moods.map((m) => m.habits.join())).size > 1);
  for (const mood of moods) {
    assert.deepEqual(mood.tell, base.tell);
    assert.ok(mood.habits.every((habit) => base.habits.includes(habit)));
    assert.ok(mood.habitMin >= base.habitMin * 0.75 && mood.habitMin <= base.habitMin * 1.3);
  }
  assert.deepEqual(withMood(base, 5), withMood(base, 5));
});

test("no mood lets you win by mashing or holding block", () => {
  const run = { ...createRunState(), node: "heron" as NodeId };
  let mashed = 0;
  for (let seed = 1; seed <= 12; seed++) {
    for (const [i, bot] of [masher(), (() => ({ ...IDLE, block: true })) as Player].entries()) {
      let duel = skipBow(createDuel(duelOptionsFor(run)));
      let rival = createRival(seed, withMood(rivalConfigFor(run), seed));
      for (let t = 0; t < MAX_TICKS && duel.phase !== "over"; t++) {
        const act = rivalAct(duel, rival);
        rival = act.rival;
        let input = bot(duel);
        if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: 1 };
        duel = step(duel, input, act.input);
      }
      if (i === 1) assert.notEqual(duel.winner, 0, `seed ${seed}`);
      else if (duel.winner === 0) mashed++;
    }
  }
  assert.ok(mashed <= 1, `mashing won ${mashed} of 12`);
});

test("how someone's feeling can be read before a match, and it's the truth", () => {
  const config = rivalConfig(0, "fierce");
  const paces = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) {
    const mood = moodOf(config, seed);
    const moody = withMood(config, seed);
    assert.equal(moody.habits.at(-1), mood!.favourite, String(seed));
    assert.equal(moody.habitMin, Math.round(config.habitMin * mood!.scale), String(seed));
    assert.equal(mood!.pace === "quick", mood!.scale < 0.95, String(seed));
    assert.equal(mood!.pace === "slow", mood!.scale > 1.1, String(seed));
    paces.add(mood!.pace);
  }
  assert.deepEqual([...paces].sort(), ["calm", "quick", "slow"]);
});

test("a scripted fight has no mood to read", () => {
  assert.equal(moodOf(rivalConfig(0, "rigged"), 1), null);
});

const swingAtRival = (duel: DuelState, attack: AttackKind): FighterInput => {
  if (duel.fighters[0].stance === "guard") return { move: 0, block: false, attack, stomp: true };
  return { move: 0, block: false, attack: null, stomp: true };
};
const atGap = (gap: number, options: Parameters<typeof createDuel>[0] = {}): DuelState => {
  const duel = skipBow(createDuel(options));
  const mid = (duel.fighters[0].x + duel.fighters[1].x) / 2;
  duel.fighters[0].x = mid - gap / 2;
  duel.fighters[1].x = mid + gap / 2;
  return duel;
};

function strikeOnce(parry: number, seed: number): DuelState["events"][number]["type"][] {
  let duel = atGap(40);
  let rival = createRival(seed, { ...rivalConfig(0, "steady"), parry, bites: 0, habitMin: 9999, habitSpread: 1 });
  const seen: DuelState["events"][number]["type"][] = [];
  for (let t = 0; t < 80 && duel.phase === "fight"; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    duel = step(duel, t === 0 ? swingAtRival(duel, "men") : { move: 0, block: false, attack: null, stomp: true }, act.input);
    seen.push(...duel.events.map((e) => e.type));
    if (seen.includes("parry") || seen.includes("blocked") || seen.includes("hit")) break;
  }
  return seen;
}

test("a rival who can parry does it right on time", () => {
  for (let seed = 1; seed <= 10; seed++) assert.ok(strikeOnce(1, seed).includes("parry"), `seed ${seed}`);
});

test("a rival who doesn't parry never does", () => {
  for (let seed = 1; seed <= 10; seed++) assert.ok(!strikeOnce(0, seed).includes("parry"), `seed ${seed}`);
});

test("how often they parry is a matter of luck", () => {
  let parried = 0;
  for (let seed = 1; seed <= 100; seed++) if (strikeOnce(0.3, seed).includes("parry")) parried++;
  assert.ok(parried > 15 && parried < 45, `${parried}`);
});

test("scripted fights and the gentlest senpai have no parry, and the best do", () => {
  assert.equal(rivalConfig(0, "rigged").parry ?? 0, 0);
  assert.equal(rivalConfig(0, "demonstration").parry ?? 0, 0);
  assert.equal(rivalConfig(0, "restless").parry ?? 0, 0);
  assert.ok((rivalConfig(0, "sensei").parry ?? 0) > (rivalConfig(0, "steady").parry ?? 0));
});

test("they parry less after beating you a few times", () => {
  assert.ok((rivalConfig(3, "sensei").parry ?? 0) < (rivalConfig(0, "sensei").parry ?? 0));
});

/** A locked duel, with the rival deciding what to do and the player doing this. */
function inLock(style: Parameters<typeof rivalConfig>[1], seed: number, player: (duel: DuelState) => FighterInput, ticks = 600) {
  let duel = step(atGap(14), { move: 0, block: false, attack: null }, { move: 0, block: false, attack: null });
  let rival = createRival(seed, rivalConfig(0, style));
  const types: string[] = ["lock"];
  let longestPull = 0;
  let pulled = 0;
  let after = 0;
  for (let t = 0; t < ticks && duel.phase !== "over"; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    duel = step(duel, player(duel), act.input);
    types.push(...duel.events.map((e) => (e.type === "kiai" && e.hiki ? "hiki" : e.type)));
    if (duel.lock?.pulling[1]) longestPull = Math.max(longestPull, ++pulled);
    else pulled = 0;
    if (!duel.lock && ++after > 20) break;
  }
  return { duel, types, longestPull };
}
const idlePlayer = (): FighterInput => ({ move: 0, block: false, attack: null });

test("a scripted rival steps straight out of a lock, so it's no way round the fight", () => {
  for (const style of ["rigged", "demonstration"] as const) {
    const { types } = inLock(style, 1, () => ({ move: 1, block: false, attack: null }), 16);
    assert.ok(types.includes("stepout"), style);
  }
});

test("a rival always shows the pull before a hiki strike", () => {
  let saw = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { longestPull, types } = inLock("steady", seed, () => ({ move: 0, block: true, attack: null }));
    if (types.includes("hiki")) {
      saw++;
      assert.ok(longestPull >= HIKI_TELL - 1, `seed ${seed}: ${longestPull}`);
    }
  }
  assert.ok(saw > 0, "some of them should have tried");
});

test("a rival doesn't just stand there in a lock: it pushes, pulls or steps out", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { types } = inLock("steady", seed, idlePlayer);
    assert.ok(types.some((t) => t === "hiki" || t === "shove" || t === "stepout" || t === "wakare"), `seed ${seed}`);
  }
});

test("rivals make use of being out of position: a shoved player gets hit", () => {
  let hit = 0;
  for (let seed = 1; seed <= 12; seed++) {
    let duel = atGap(40);
    duel.fighters[0].stance = "stumble";
    duel.fighters[0].stanceTicks = 40;
    let rival = createRival(seed, rivalConfig(0, "steady"));
    for (let t = 0; t < 60 && duel.phase === "fight"; t++) {
      const act = rivalAct(duel, rival);
      rival = act.rival;
      duel = step(duel, idlePlayer(), act.input);
    }
    if (duel.phase === "zanshin") hit++;
  }
  assert.equal(hit, 12);
});

/** Frame-perfect at the lock, and at nothing else: charges in, always picks what beats what the rival's doing, and hits anything left off balance. */
const lockReader = (): Player => {
  let lastDash = -999;
  let t = 0;
  return (duel) => {
    t++;
    const me = duel.fighters[0];
    const them = duel.fighters[1];
    const gap = distance(duel);
    if (duel.phase !== "fight") return IDLE;
    if (duel.lock) {
      if (duel.lock.pulling[1]) return { ...IDLE, block: true };
      if (duel.lock.pulling[0]) return { ...IDLE, stomp: true };
      if (duel.lock.pushing[1]) return { ...IDLE, attack: "men", stomp: true };
      return { ...IDLE, move: 1 };
    }
    if (me.stance === "windup" || me.queued) return { ...IDLE, stomp: true };
    if (me.stance !== "guard" && me.stance !== "block") return IDLE;
    if (me.launchTicks > 0) return IDLE;
    if (them.stance === "stumble" && gap <= RANGE_MAX && gap >= RANGE_MIN) return { ...IDLE, attack: "men", stomp: true };
    if (them.stance === "windup" && gap <= 56) return { ...IDLE, block: true };
    if (gap > 44) return { ...IDLE, move: 1 };
    if (t - lastDash > 40) {
      lastDash = t;
      return { ...IDLE, dash: 1 };
    }
    return { ...IDLE, block: true };
  };
};

/** How often that beats someone, with no seme and starting the fight in this dojo. */
function lockWins(versus: string | null, node: NodeId, matches = 30): number {
  const run = { ...createRunState(), node, dan: 1, seme: false };
  let wins = 0;
  for (let seed = 1; seed <= matches; seed++) {
    const me = lockReader();
    let duel = skipBow(createDuel(duelOptionsFor(run, versus as never)));
    let rival = createRival(seed, withMood(rivalConfigFor(run, versus as never), seed ^ 77));
    for (let t = 0; t < 7200 && duel.phase !== "over"; t++) {
      const act = rivalAct(duel, rival);
      rival = act.rival;
      let input = me(duel);
      if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: duel.zanshin.dir };
      duel = step(duel, input, act.input);
    }
    if (duel.winner === 0) wins++;
  }
  return wins;
}

test("the lock is no way round seme: the best still beat someone who only knows the lock", () => {
  for (const [name, versus, node] of [["Sensei", "sensei", "pinecone"], ["Ren", null, "radish"], ["Raiko", "raiko", "radish"], ["Kan", "kan", "goose"], ["Nemu", "nemu", "raccoon"], ["Hagane", "hagane", "heron"], ["Mizu", "mizu", "otter"]] as const) {
    const wins = lockWins(versus, node as NodeId);
    assert.ok(wins <= 4, `${name}: ${wins}/30`);
  }
});

test("a lock is worth having against ordinary fighters, so it's worth learning", () => {
  for (const [name, versus, node] of [["Aki", "aki", "pinecone"], ["Hana", null, "goose"], ["Kenji", null, "otter"]] as const) {
    const wins = lockWins(versus, node as NodeId);
    assert.ok(wins >= 6, `${name}: ${wins}/30`);
  }
});

test("Momo's barrier holds: the lock gets you no points at all", () => {
  assert.equal(lockWins(null, "pinecone"), 0);
});

test("the better the fighter, the better they are in a lock", () => {
  assert.ok((rivalConfig(0, "sensei").lockSkill ?? 0) > (rivalConfig(0, "steady").lockSkill ?? 0));
  assert.ok((rivalConfig(0, "steady").lockSkill ?? 0) > (rivalConfig(0, "restless").lockSkill ?? 0));
});

function swingAtMeeting(attack: AttackKind, seed = 1): DuelState {
  let duel = atGap(40);
  let rival = createRival(seed, { ...rivalConfig(0, "steady"), parry: 0, meets: 1, habitMin: 9999, habitSpread: 1 });
  for (let t = 0; t < 70 && duel.phase === "fight"; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    duel = step(duel, t === 0 ? { move: 0, block: false, attack, stomp: true } : { move: 0, block: false, attack: null, stomp: true }, act.input);
  }
  return duel;
}

test("a rival can meet your swing with their own, and you both go through, whatever you swung", () => {
  for (const attack of ["men", "do", "kote"] as const) assert.equal(swingAtMeeting(attack).phase, "crossing", attack);
});

test("going for the same target every time doesn't turn crossings into free points", () => {
  // Someone patient who only ever swings kote, because a met swing used to leave the wrist open.
  for (const style of ["steady", "fierce", "sensei"] as const) {
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let duel = skipBow(createDuel());
      let rival = createRival(seed, rivalConfig(0, style));
      let wait = 0;
      for (let t = 0; t < 3600 && duel.phase !== "over"; t++) {
        const act = rivalAct(duel, rival);
        rival = act.rival;
        const me = duel.fighters[0];
        let input: FighterInput = { ...IDLE, stomp: me.stance === "windup" };
        if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...IDLE, move: duel.zanshin.dir };
        else if (duel.lock) input = { ...IDLE, move: 1 };
        else if (duel.phase === "fight" && me.stance === "guard") {
          const gap = distance(duel);
          if (gap > 44) input = { ...IDLE, move: 1 };
          else if (gap < 24) input = { ...IDLE, move: -1 };
          else if (++wait % 80 === 0) input = { ...IDLE, attack: "kote", stomp: true };
        }
        duel = step(duel, input, act.input);
      }
      if (duel.winner === 0) wins++;
    }
    assert.ok(wins <= 6, `${style}: ${wins} of 20`);
  }
});

test("scripted fights never meet a swing", () => {
  assert.equal(rivalConfig(0, "rigged").meets ?? 0, 0);
  assert.equal(rivalConfig(0, "demonstration").meets ?? 0, 0);
});

test("swinging again and again gets you blocked, not met", () => {
  let duel = atGap(40);
  let rival = { ...createRival(1, { ...rivalConfig(0, "steady"), parry: 0, meets: 1, habitMin: 9999, habitSpread: 1 }), sinceSwing: 0 };
  // Someone who swings as soon as they can, starting just after they've been seen swinging.
  for (let t = 0; t < 200 && duel.phase === "fight"; t++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    const me = duel.fighters[0];
    duel = step(duel, me.stance === "guard" ? { move: 0, block: false, attack: "men", stomp: true } : { move: 0, block: false, attack: null, stomp: true }, act.input);
    assert.ok(!duel.events.some((e) => e.type === "cross"), `crossed at ${t}`);
  }
});

test("everyone else does, some of the time", () => {
  for (const style of ["steady", "fierce", "sneaky", "patient", "relentless", "master", "sensei", "fury", "torrent", "iron", "shadow", "jodan", "nito", "restless", "wall", "exact"] as const) {
    assert.ok((rivalConfig(0, style).meets ?? 0) > 0, style);
  }
});

test("crossings actually happen in ordinary matches, and more than once", () => {
  // Someone sensible: blocks what's coming, answers some of it, and every so often just goes for it.
  const sensible = (): Player => {
    let wait = 0;
    const reader = tellReader();
    return (duel) => {
      if (duel.phase === "zanshin" && duel.zanshin?.by === 0) return { ...IDLE, move: duel.zanshin.dir };
      if (duel.phase !== "fight") return IDLE;
      if (duel.lock) return { ...IDLE, move: 1 };
      const me = duel.fighters[0];
      if (me.stance === "windup" || me.queued) return { ...IDLE, stomp: true };
      if ((me.stance === "guard" || me.stance === "block") && distance(duel) <= RANGE_MAX - 2 && distance(duel) >= RANGE_MIN + 4 && ++wait % 90 === 0) return { ...IDLE, attack: "men", stomp: true };
      return reader(duel);
    };
  };
  let crossings = 0;
  const matches = 20;
  for (let seed = 1; seed <= matches; seed++) {
    let duel = skipBow(createDuel());
    let rival = createRival(seed, rivalConfig(0, "steady"));
    const me = sensible();
    for (let t = 0; t < 5400 && duel.phase !== "over"; t++) {
      const act = rivalAct(duel, rival);
      rival = act.rival;
      duel = step(duel, me(duel), act.input);
      if (duel.events.some((e) => e.type === "cross")) crossings++;
    }
  }
  assert.ok(crossings / matches >= 0.5, `${crossings} in ${matches} matches`);
});
