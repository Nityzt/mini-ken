import test from "node:test";
import assert from "node:assert/strict";
import { FULL_GEAR } from "../art/kendoka.ts";
import { RANGE_MAX, RANGE_MIN } from "../duel/constants.ts";
import { createRival, rivalAct } from "../duel/rival.ts";
import { createDuel, distance, exposes, skipBow, step, type AttackKind, type DuelState, type FighterInput } from "../duel/rules.ts";
import { createRunState, duelOptionsFor, recordLoss, rivalConfigFor, type RunState } from "../run-state.ts";
import { CHARACTERS } from "../characters.ts";
import { CANDIDATES, DOJOS, MEMBERS, opponentById, SPAR_PARTNERS } from "../world/dojos.ts";
import { senpaiMenu, senseiMenu } from "./club-story.ts";
import { canChallengeSensei, challengerHome, challengerWin, isChallenger, talkToChallenger } from "./challengers.ts";
import { dojoSenseiMenu, headMenu, helperMenu } from "./club-story.ts";

const start = createRunState();
const IDLE: FighterInput = { move: 0, block: false, attack: null };
type Bot = (duel: DuelState) => FighterInput;

function winsAgainstSensei(bot: () => Bot, run: RunState): number {
  let won = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const me = bot();
    let duel = skipBow(createDuel(duelOptionsFor(run, "sensei")));
    let rival = createRival(seed, rivalConfigFor(run, "sensei"));
    for (let t = 0; t < 3600 && duel.phase !== "over"; t++) {
      const act = rivalAct(duel, rival);
      rival = act.rival;
      let input = me(duel);
      if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: 1 };
      duel = step(duel, input, act.input);
    }
    if (duel.winner === 0) won++;
  }
  return won;
}

const masher = (): Bot => {
  let n = 0;
  const cycle: AttackKind[] = ["men", "kote", "do"];
  return (duel) => (distance(duel) > RANGE_MAX - 2 ? { ...IDLE, move: 1 } : { ...IDLE, attack: cycle[n++ % 3], stomp: true });
};

/** Answers each tell after a human delay. With seme, it presses back while it waits instead of hiding behind its guard. */
const tellReader = (waits: "seme" | "block" | "guard"): Bot => {
  let watching: AttackKind | null = null;
  let seenFor = 0;
  return (duel) => {
    const them = duel.fighters[1];
    const dist = distance(duel);
    const tell = them.stance === "windup" ? them.attack : null;
    if (tell !== watching) {
      watching = tell;
      seenFor = 0;
    } else if (tell) seenFor++;
    if (dist > RANGE_MAX - 2) return { ...IDLE, move: 1 };
    if (dist < RANGE_MIN + 4) return { ...IDLE, move: -1 };
    if (tell && seenFor >= 14) return { ...IDLE, attack: exposes(tell, them.kamae), stomp: true };
    if (them.stance === "recovery" || them.stance === "shaken") return { ...IDLE, attack: "men", stomp: true };
    if (waits === "guard") return IDLE;
    return waits === "seme" && duel.fighters[0].ki > 30 ? { ...IDLE, seme: true } : { ...IDLE, block: true };
  };
};

test("Tetsu and Shin won't fight you until you've got the rank", () => {
  assert.equal(talkToChallenger(start, "tetsu").fight, false);
  assert.match(talkToChallenger(start, "tetsu").lines.join(" "), /1st dan/);
  assert.equal(talkToChallenger({ ...start, dan: 1 }, "tetsu").fight, true);
  assert.equal(talkToChallenger({ ...start, dan: 1 }, "shin").fight, false);
  assert.match(talkToChallenger({ ...start, dan: 1 }, "shin").lines.join(" "), /2nd dan/);
  assert.equal(talkToChallenger({ ...start, dan: 2 }, "shin").fight, true);
});

test("beating someone tough gets you an exception: the next dan, skipping the grading", () => {
  const sensei = challengerWin(start, "sensei");
  assert.equal(sensei.run.dan, 1);
  assert.match(sensei.lines.join(" "), /exception/i);
  assert.match(sensei.lines.join(" "), /1st dan/);
  assert.equal(challengerWin({ ...start, dan: 1 }, "tetsu").run.dan, 2);
  assert.equal(challengerWin({ ...start, dan: 2 }, "shin").run.dan, 3);
});

test("an exception never takes you down, and nobody mentions one if your rank didn't change", () => {
  const later = challengerWin({ ...start, dan: 3 }, "sensei");
  assert.equal(later.run.dan, 3);
  assert.doesNotMatch(later.lines.join(" "), /exception/i);
});

test("Sensei can be challenged once you've beaten a senpai, and not before", () => {
  const armored = { ...start, gear: FULL_GEAR, trained: true, senseiRounds: 3 };
  assert.equal(canChallengeSensei(armored), false);
  assert.equal(canChallengeSensei({ ...armored, beaten: ["bo"] }), true);
  assert.equal(canChallengeSensei(start), false);
});

test("Sensei offers it, but only when you could really do it", () => {
  const armored = { ...start, gear: FULL_GEAR, trained: true, senseiRounds: 3, gi: true };
  const has = (run: RunState, id: string) => senseiMenu(run).some((option) => option.id === id);
  assert.equal(has(armored, "challenge"), false);
  assert.equal(has({ ...armored, beaten: ["bo"] }, "challenge"), true);
  assert.equal(has(armored, "line"), true);
  assert.equal(has(armored, "grade"), true);
  assert.equal(has({ ...armored, dan: 3 }, "grade"), false);
  assert.equal(senpaiMenu(armored).some((option) => option.id === "spar"), true);
  assert.equal(senpaiMenu(armored).some((option) => option.id === "grade"), true);
  assert.equal(senpaiMenu({ ...armored, dan: 3 }).some((option) => option.id === "grade"), false);
});

test("Sensei waits at home, and everyone else in their own dojo", () => {
  assert.equal(challengerHome("sensei"), "club");
  assert.equal(challengerHome("tetsu"), "rival-dojo");
  assert.equal(opponentById("sensei").rival, "Sensei Kuma");
});

test("Sensei can't be beaten by standing there, mashing or holding block, and seme is what makes it winnable", () => {
  const ready = { ...start, gear: FULL_GEAR, beaten: ["bo" as const], bonusKi: 10 };
  const idle: Bot = () => IDLE;
  assert.equal(winsAgainstSensei(() => idle, ready), 0);
  assert.equal(winsAgainstSensei(() => () => ({ ...IDLE, block: true }), ready), 0);
  assert.ok(winsAgainstSensei(masher, ready) <= 2);
  assert.equal(winsAgainstSensei(() => tellReader("block"), ready), 0);
  const standing = winsAgainstSensei(() => tellReader("guard"), ready);
  assert.ok(standing <= 3, `${standing} of 20 reading every tell without seme`);
  const withSeme = winsAgainstSensei(() => tellReader("seme"), { ...ready, seme: true, bonusKi: 35 });
  assert.ok(withSeme >= 15, `${withSeme} of 20 with seme`);
});

test("Sensei's stare never eases off, however often you've lost, and isn't touched by Ren's gaze", () => {
  let run = { ...start, gaze: true };
  for (let i = 0; i < 6; i++) run = recordLoss(run, "sensei");
  assert.equal(duelOptionsFor(run, "sensei").presence?.[1], opponentById("sensei").presence);
  assert.equal(duelOptionsFor(run, "sensei").semeTaken, undefined);
});
test("they explain what they do before you fight them", () => {
  assert.match(talkToChallenger({ ...start, dan: 1 }, "tetsu").lines.join(" "), /jodan/i);
  assert.match(talkToChallenger({ ...start, dan: 2 }, "shin").lines.join(" "), /nito|two swords/i);
});

test("beating one is worth ki the first time, and they'll go again after", () => {
  const first = challengerWin({ ...start, dan: 1, node: "goose" }, "tetsu");
  assert.ok(first.run.bonusKi > 0);
  assert.ok(first.run.beaten.includes("tetsu"));
  assert.equal(challengerWin(first.run, "tetsu").run.bonusKi, first.run.bonusKi);
  assert.equal(talkToChallenger(first.run, "tetsu").fight, true);
  assert.notDeepEqual(talkToChallenger(first.run, "tetsu").lines, talkToChallenger({ ...start, dan: 1 }, "tetsu").lines);
});

test("they're at the dojos you'd expect, and nobody else counts as one", () => {
  assert.equal(DOJOS.goose.challenger, "tetsu");
  assert.equal(DOJOS.heron.challenger, "shin");
  assert.equal(DOJOS.raccoon.challenger, undefined);
  assert.ok(isChallenger("tetsu") && isChallenger("shin"));
  assert.equal(isChallenger("aki"), false);
  assert.equal(isChallenger(null), false);
});

test("nobody you can fight shares a name with someone you can play as", () => {
  const taken = new Set(CHARACTERS.map((c) => c.name));
  for (const who of [...Object.values(MEMBERS), ...Object.values(CANDIDATES), ...Object.values(DOJOS), ...Object.values(SPAR_PARTNERS)]) assert.equal(taken.has(who.rival), false, who.rival);
});

const DOJO_HEADS = ["nemu", "kan", "mizu", "hagane", "raiko"] as const;

function winsAgainst(id: (typeof DOJO_HEADS)[number], bot: () => Bot, run: RunState): number {
  let won = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const me = bot();
    let duel = skipBow(createDuel(duelOptionsFor(run, id)));
    let rival = createRival(seed, rivalConfigFor(run, id));
    for (let t = 0; t < 3600 && duel.phase !== "over"; t++) {
      const act = rivalAct(duel, rival);
      rival = act.rival;
      let input = me(duel);
      if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: 1 };
      duel = step(duel, input, act.input);
    }
    if (duel.winner === 0) won++;
  }
  return won;
}

test("no dojo's sensei will fight you without a high rank", () => {
  for (const id of DOJO_HEADS) {
    assert.equal(talkToChallenger(start, id).fight, false, id);
    assert.equal(talkToChallenger({ ...start, dan: 1 }, id).fight, false, id);
    assert.equal(talkToChallenger({ ...start, dan: 3 }, id).fight, true, id);
  }
  assert.match(talkToChallenger(start, "raiko").lines.join(" "), /3rd dan/);
});

test("beating a dojo's sensei is its own reward, and doesn't change your rank", () => {
  for (const id of DOJO_HEADS) {
    const before = { ...start, dan: 3 };
    const reply = challengerWin(before, id);
    assert.equal(reply.run.dan, 3, id);
    assert.ok(reply.run.money > before.money, id);
    assert.ok(reply.run.beaten.includes(id), id);
    assert.ok(isChallenger(id), id);
    assert.equal(challengerHome(id), "rival-dojo", id);
  }
});

test("a dojo's sensei can't be beaten by mashing or hiding, even with everything you could have", () => {
  const strong = { ...start, dan: 3, gear: FULL_GEAR, seme: true, bonusKi: 100 };
  for (const id of DOJO_HEADS) {
    assert.equal(winsAgainst(id, masher, strong), 0, `${id} mash`);
    // Even a perfect reader who never presses back should almost never get there.
    assert.ok(winsAgainst(id, () => tellReader("block"), { ...strong, seme: false }) <= 3, `${id} no seme`);
  }
});

test("a dojo's sensei can be beaten by someone who reads them and presses back", () => {
  const strong = { ...start, dan: 3, gear: FULL_GEAR, seme: true, bonusKi: 100 };
  for (const id of DOJO_HEADS) assert.ok(winsAgainst(id, () => tellReader("seme"), strong) >= 10, id);
});

test("a dojo's sensei fights in their own dojo", () => {
  assert.equal(opponentById("nemu").crest, "raccoon");
  assert.equal(opponentById("kan").crest, "goose");
  assert.equal(opponentById("mizu").crest, "otter");
  assert.equal(opponentById("hagane").crest, "heron");
  assert.equal(opponentById("raiko").crest, "radish");
  for (const id of DOJO_HEADS) assert.ok((opponentById(id).ki ?? 0) >= 170, id);
});

test("a rival dojo's menus let you ask about grading, unless you're past it", () => {
  assert.ok(helperMenu(start).some((option) => option.id === "grade"));
  assert.ok(headMenu(start).some((option) => option.id === "challenge"));
  assert.ok(headMenu(start).some((option) => option.id === "grade"));
  assert.ok(!helperMenu({ ...start, dan: 3 }).some((option) => option.id === "grade"));
  assert.ok(dojoSenseiMenu(start).some((option) => option.id === "challenge"));
});
