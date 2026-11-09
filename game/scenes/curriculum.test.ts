import test from "node:test";
import assert from "node:assert/strict";
import { FULL_GEAR, NO_GEAR, type Gear } from "../art/kendoka.ts";
import type { Action, Input } from "../core/input.ts";
import { RANGE_MAX } from "../duel/constants.ts";
import { distance, skipBow, step, type AttackKind, type DuelState, type FighterInput } from "../duel/rules.ts";
import {
  challengeFor, CHALLENGE_REWARD, createLessonDuel, judge, lessonsFor, partnerName, SENPAI, SENPAI_IDS, SENSEI_ROUNDS, sessionPartner, sessionPlace, type Lesson, type SenpaiId,
} from "./curriculum.ts";
import { createPlayerControl } from "./duel.ts";

const IDLE: FighterInput = { move: 0, block: false, attack: null };
type Player = (duel: DuelState, tick: number) => FighterInput;

/** Plays one lesson the way the scene does: strikes count up, misses count up, and either can end it. */
function play(lesson: Lesson, player: Player, gear: Gear, ticks = 6000, { literal = false } = {}): { passed: boolean; failed: boolean; reps: number; misses: number } {
  const needed = lesson.reps ?? 1;
  let duel = skipBow(createLessonDuel(lesson));
  let memo: Record<string, boolean> = {};
  let reps = 0;
  let misses = 0;
  for (let t = 0; t < ticks; t++) {
    const input = player(duel, t);
    // The tests below say what to strike. Everyone strikes from an opening, and which one doesn't matter here.
    // Unless the test is pressing the keys itself, exactly as some text says, and nothing more.
    const opensFirst = !literal && input.attack && !duel.lock && duel.fighters[0].counterTicks === 0;
    duel = step(duel, opensFirst ? { ...input, opening: "wrist" } : input, lesson.partner(t, duel));
    if (lesson.done(duel.events, duel, memo)) {
      if (++reps >= needed) return { passed: true, failed: false, reps, misses };
      duel = skipBow(createLessonDuel(lesson));
      memo = {};
      continue;
    }
    if (lesson.misses !== undefined && judge(duel.events, gear)) {
      if (++misses >= lesson.misses) return { passed: false, failed: true, reps, misses };
    }
    if (duel.phase === "point") {
      duel = skipBow(createLessonDuel(lesson));
      memo = {};
    }
  }
  return { passed: false, failed: false, reps, misses };
}

/** Closes the distance, waits for an opening, and strikes with the full combo. */
function striker(attack: AttackKind, whenOpen: (duel: DuelState) => boolean, options: { stomp?: boolean; slide?: boolean; guardUp?: boolean } = {}): Player {
  const { stomp = true, slide = true, guardUp = false } = options;
  return (duel) => {
    const me = duel.fighters[0];
    if (duel.phase === "zanshin") return { ...IDLE, move: slide ? 1 : 0 };
    if (me.stance !== "guard" && me.stance !== "block") return IDLE;
    if (distance(duel) > 42) return { ...IDLE, move: 1 };
    if (distance(duel) < 24) return { ...IDLE, move: -1 };
    if (whenOpen(duel)) return { ...IDLE, attack, stomp };
    return { ...IDLE, block: guardUp };
  };
}

const anytime = (duel: DuelState) => duel.fighters[1].stance === "guard";
const tellOf = (kind: AttackKind) => (duel: DuelState) => duel.fighters[1].stance === "windup" && duel.fighters[1].attack === kind && duel.fighters[1].stanceTicks < 40;

const BEFORE: Record<number, Gear> = {
  0: { ...NO_GEAR, shinai: true, tare: true },
  1: { ...NO_GEAR, shinai: true, tare: true, do: true },
  2: { ...NO_GEAR, shinai: true, tare: true, do: true, men: true },
};
const LEVEL_BOT: Record<number, () => Player> = {
  0: () => striker("men", anytime),
  1: () => striker("do", tellOf("bigMen"), { guardUp: true }),
  2: () => striker("kote", tellOf("men"), { guardUp: true }),
};

test("Sensei's first round is only footwork, openings, men, fumikomi and follow-through", () => {
  assert.deepEqual(SENSEI_ROUNDS[0].map((l) => l.id), ["suriashi", "opening", "fumikomi", "zanshin"]);
});

test("there are three rounds with Sensei, and seme isn't one of them", () => {
  assert.equal(SENSEI_ROUNDS.length, 3);
  for (const round of SENSEI_ROUNDS) assert.equal(round.some((l) => l.id === "seme"), false);
});

test("each armor piece after the tare comes from a senpai challenge", () => {
  assert.deepEqual(CHALLENGE_REWARD, ["do", "men", "kote"]);
});

test("there's more than one senpai, each with their own personality", () => {
  assert.ok(SENPAI_IDS.length >= 3);
  assert.equal(new Set(SENPAI_IDS.map((id) => SENPAI[id].intro)).size, SENPAI_IDS.length);
});

test("the footwork drill needs sliding in, out and back in", () => {
  const suriashi = SENSEI_ROUNDS[0][0];
  const inOnly: Player = (duel) => (distance(duel) > 44 ? { ...IDLE, move: 1 } : IDLE);
  assert.equal(play(suriashi, inOnly, NO_GEAR, 400).passed, false);
  let leg = 0;
  const inOutIn: Player = (duel) => {
    if (leg === 0 && distance(duel) <= 44) leg = 1;
    if (leg === 1 && distance(duel) >= 60) leg = 2;
    return { ...IDLE, move: leg === 1 ? -1 : 1 };
  };
  assert.ok(play(suriashi, inOutIn, NO_GEAR).passed);
});

test("the first round's strikes need the stomp and then the slide", () => {
  const [, , fumikomi, zanshin] = SENSEI_ROUNDS[0];
  assert.ok(play(fumikomi, striker("men", anytime), NO_GEAR).passed);
  assert.equal(play(fumikomi, striker("men", anytime, { stomp: false }), NO_GEAR, 300).passed, false);
  assert.ok(play(zanshin, striker("men", anytime), NO_GEAR).passed);
  assert.equal(play(zanshin, striker("men", anytime, { slide: false }), NO_GEAR, 300).passed, false);
});

test("the later rounds can be finished by doing what they teach", () => {
  const byId = (round: number, id: string) => SENSEI_ROUNDS[round].find((l) => l.id === id)!;
  assert.ok(play(byId(1, "block"), () => ({ ...IDLE, block: true }), BEFORE[1]).passed);
  assert.ok(play(byId(1, "do"), striker("do", tellOf("bigMen")), BEFORE[1]).passed);
  assert.ok(play(byId(2, "kote"), striker("kote", tellOf("men")), BEFORE[2]).passed);
  let launched = false;
  const launch: Player = (duel) => {
    if (duel.phase === "zanshin") return { ...IDLE, move: 1 };
    if (!launched) { launched = true; return { ...IDLE, dash: 1 }; }
    return distance(duel) < 60 && duel.fighters[0].stance === "guard" ? { ...IDLE, attack: "men", stomp: true } : IDLE;
  };
  assert.ok(play(byId(2, "launch"), launch, BEFORE[2]).passed);
});

test("doing nothing finishes no drill and no challenge", () => {
  for (const round of SENSEI_ROUNDS) for (const lesson of round) assert.equal(play(lesson, () => IDLE, FULL_GEAR, 800).passed, false, lesson.id);
  for (const id of SENPAI_IDS) for (const level of [0, 1, 2]) assert.equal(play(challengeFor(id, level), () => IDLE, BEFORE[level], 2000).passed, false, `${id} ${level}`);
});

for (const id of SENPAI_IDS) {
  for (const level of [0, 1, 2]) {
    test(`${id}'s challenge at level ${level} can be passed by doing the drill well`, () => {
      const result = play(challengeFor(id, level), LEVEL_BOT[level](), BEFORE[level]);
      assert.ok(result.passed, JSON.stringify(result));
    });
  }
}

test("each senpai's first challenge fails if you never stomp", () => {
  for (const id of SENPAI_IDS) {
    const noStomp = striker("men", anytime, { stomp: false });
    const result = play(challengeFor(id, 0), noStomp, BEFORE[0]);
    assert.ok(result.failed, `${id} ${JSON.stringify(result)}`);
  }
});

test("the first challenge is the same drill as Sensei's first round: men", () => {
  for (const id of SENPAI_IDS) assert.equal(play(challengeFor(id, 0), striker("do", anytime), BEFORE[0], 1500).passed, false, id);
});

test("no partner really hits you before you wear the do", () => {
  for (const id of SENPAI_IDS) {
    const result = play(challengeFor(id, 0), () => IDLE, BEFORE[0], 2000);
    assert.equal(result.misses, 0, id);
  }
});

test("a partner's hit is a miss only where you wear armor", () => {
  const hit = (target: "men" | "kote" | "do") => [{ type: "clean" as const, by: 1 as const, target }];
  assert.equal(judge(hit("do"), BEFORE[0]), false);
  assert.equal(judge(hit("do"), BEFORE[1]), true);
  assert.equal(judge(hit("men"), BEFORE[1]), false);
  assert.equal(judge(hit("men"), BEFORE[2]), true);
});

test("your own errors count as misses", () => {
  for (const type of ["flat", "nozanshin", "whiff", "blocked"] as const) assert.equal(judge([{ type, by: 0 }], NO_GEAR), true, type);
  assert.equal(judge([{ type: "blocked", by: 1 }], NO_GEAR), false);
  assert.equal(judge([{ type: "lock", by: 0 }], NO_GEAR), false);
});

test("an idle player takes real hits only at the levels where they wear armor", () => {
  for (const id of SENPAI_IDS) {
    const lesson = challengeFor(id, 1);
    const unarmored = play(lesson, () => IDLE, { ...NO_GEAR, shinai: true }, 2000);
    assert.equal(unarmored.misses, 0, `${id} without armor`);
    const armored = play(lesson, () => IDLE, BEFORE[1], 2000);
    assert.ok(armored.misses > 0 || armored.failed, `${id} with a do`);
  }
});

test("the senpai run the drill differently from one another", () => {
  const aki = challengeFor("aki", 0);
  const bo = challengeFor("bo", 0);
  const yui = challengeFor("yui", 0);
  const positions = (lesson: Lesson) => {
    let duel = skipBow(createLessonDuel(lesson));
    const xs = new Set<number>();
    let blocks = 0;
    for (let t = 0; t < 400; t++) {
      duel = step(duel, IDLE, lesson.partner(t, duel));
      xs.add(Math.round(duel.fighters[1].x));
      if (duel.fighters[1].stance === "block") blocks++;
    }
    return { moved: xs.size, blocks };
  };
  assert.ok(positions(aki).moved > 5, "Aki moves");
  assert.ok(positions(bo).blocks > 100, "Bo guards");
  assert.equal(positions(bo).moved, 1);
  assert.ok(distance(createLessonDuel(yui)) > 48, "Yui starts far away");
  assert.ok(yui.misses! < aki.misses!, "Yui is stricter");
});

// Old Gen's three stages.
const SEME_IDS = ["seme-hold", "seme-punish", "seme-read"];
const HOLD: Player = () => ({ ...IDLE, seme: true });
const genStage = (id: string) => lessonsFor({ kind: "master" }).find((l) => l.id === id)!;
/** Presses until Gen flinches, then punishes it. */
const punisher: Player = (duel) => {
  const [me, gen] = duel.fighters;
  if (duel.phase === "zanshin") return { ...IDLE, move: 1 };
  if (me.stance === "windup" || me.stance === "recovery" || me.stance === "shaken") return IDLE;
  if (gen.stance === "shaken") return { ...IDLE, attack: "men", stomp: true };
  return { ...IDLE, seme: true };
};
/** Presses until Gen swings, lets go, and answers with do. */
const reader: Player = (duel) => {
  const [me, gen] = duel.fighters;
  if (duel.phase === "zanshin") return { ...IDLE, move: 1 };
  if (me.stance === "windup" || me.stance === "recovery" || me.stance === "shaken") return IDLE;
  if (gen.stance === "windup" && gen.attack === "bigMen") return gen.stanceTicks < 40 ? { ...IDLE, attack: "do", stomp: true } : IDLE;
  return { ...IDLE, seme: true };
};

test("Old Gen teaches seme in three stages, in order", () => {
  assert.deepEqual(lessonsFor({ kind: "master" }).map((l) => l.id), SEME_IDS);
});

test("every stage has a limit on misses", () => {
  for (const lesson of lessonsFor({ kind: "master" })) assert.ok(lesson.misses !== undefined && lesson.misses <= 3, lesson.id);
});

test("stage one: holding seme against Gen's aura makes Gen flinch", () => {
  assert.ok(play(genStage("seme-hold"), HOLD, FULL_GEAR).passed);
});

test("stage one: standing there just gets you flinching until you're sent away", () => {
  assert.ok(play(genStage("seme-hold"), () => IDLE, FULL_GEAR).failed);
});

test("stage one: dabbing at seme doesn't hold the aura off", () => {
  const dab: Player = (_d, t) => ({ ...IDLE, seme: t % 60 < 20 });
  assert.equal(play(genStage("seme-hold"), dab, FULL_GEAR).passed, false);
});

test("stage two: pressing alone isn't enough, the flinch has to be punished", () => {
  assert.equal(play(genStage("seme-punish"), HOLD, FULL_GEAR, 1500).passed, false);
  assert.ok(play(genStage("seme-punish"), punisher, FULL_GEAR).passed);
});

test("stage two: swinging at Gen's guard gets you sent away", () => {
  const swinger: Player = (duel) => (duel.fighters[0].stance === "guard" ? { ...IDLE, attack: "men", stomp: true } : IDLE);
  assert.ok(play(genStage("seme-punish"), swinger, FULL_GEAR).failed);
});

test("stage three: holding on through Gen's big swing gets you hit", () => {
  assert.ok(play(genStage("seme-read"), HOLD, FULL_GEAR).failed);
});

test("stage three: letting go and answering with do passes", () => {
  assert.ok(play(genStage("seme-read"), reader, FULL_GEAR).passed);
});

test("stage three: never pressing means Gen never swings, so there's nothing to answer", () => {
  assert.equal(play(genStage("seme-read"), () => ({ ...IDLE, block: true }), FULL_GEAR, 1500).passed, false);
});

test("a flinch counts as a miss", () => {
  assert.equal(judge([{ type: "shaken", by: 0 }], FULL_GEAR), true);
  assert.equal(judge([{ type: "shaken", by: 1 }], FULL_GEAR), false);
});

test("sessions map to the right lessons", () => {
  assert.deepEqual(lessonsFor({ kind: "sensei", round: 0 }).map((l) => l.id), ["suriashi", "opening", "fumikomi", "zanshin"]);
  assert.equal(lessonsFor({ kind: "senpai", senpai: "bo" as SenpaiId, level: 1 }).length, 1);
});

test("the partner's tells are slow enough for a beginner", () => {
  for (const round of SENSEI_ROUNDS) for (const lesson of round) for (const ticks of Object.values(lesson.windups)) assert.ok(ticks! >= 60, lesson.id);
  for (const id of SENPAI_IDS) for (const level of [0, 1, 2]) for (const ticks of Object.values(challengeFor(id, level).windups)) assert.ok(ticks! >= 44, `${id} ${level}`);
});

test("training happens at home, except with Old Gen, and your partner isn't also watching", () => {
  assert.equal(sessionPlace({ kind: "sensei", round: 0 }), "pinecone");
  assert.equal(sessionPlace({ kind: "senpai", senpai: "yui", level: 2 }), "pinecone");
  assert.equal(sessionPlace({ kind: "master" }), "hut");
  assert.equal(sessionPartner({ kind: "sensei", round: 0 }), "sensei");
  assert.equal(sessionPartner({ kind: "senpai", senpai: "yui", level: 2 }), "yui");
  assert.equal(sessionPartner({ kind: "master" }), null);
});

// Parry, the lock and crossing: taught before 1st dan, and in the short tutorial.
const wazaLesson = (id: string) => lessonsFor({ kind: "waza" }).find((l) => l.id === id)!;
const follow = (duel: DuelState): FighterInput | null => (duel.phase === "zanshin" && duel.zanshin?.by === 0 ? { ...IDLE, move: duel.zanshin.dir } : null);
const parrier: Player = (duel) => {
  const them = duel.fighters[1];
  return them.stance === "windup" && them.stanceTicks <= 8 && duel.fighters[0].stance === "guard" ? { ...IDLE, block: true, parry: true } : IDLE;
};
const parryThenHit: Player = (duel) => {
  const after = follow(duel);
  if (after) return after;
  const [me, them] = duel.fighters;
  if (me.stance === "windup") return { ...IDLE, stomp: true };
  if (them.stance === "deflected" && me.stance === "guard") return { ...IDLE, attack: "men", stomp: true };
  return parrier(duel, 0);
};
const pusher: Player = () => ({ ...IDLE, move: 1 });
const puller: Player = (duel) => follow(duel) ?? (duel.lock && !duel.lock.pulling[0] ? { ...IDLE, attack: "men", stomp: true } : { ...IDLE, stomp: true });
const holder: Player = (duel) => (duel.lock?.pulling[1] || duel.fighters[1].stance === "windup" ? { ...IDLE, block: true } : IDLE);
const swinger: Player = (duel) => (duel.fighters[0].stance === "guard" ? { ...IDLE, attack: "men", stomp: true } : { ...IDLE, stomp: true });
const crossThenHit: Player = (duel) => {
  const after = follow(duel);
  if (after) return after;
  const me = duel.fighters[0];
  if (me.stance === "windup") return { ...IDLE, stomp: true };
  if (duel.phase !== "fight") return IDLE;
  if (distance(duel) > 44) return { ...IDLE, move: 1 };
  return { ...IDLE, attack: "men", stomp: true };
};

test("the waza round teaches parry, the lock and crossing, in that order", () => {
  assert.deepEqual(lessonsFor({ kind: "waza" }).map((l) => l.id), ["parry", "parry-counter", "lock-push", "lock-hiki", "lock-hold", "cross", "cross-turn"]);
});

test("waza lessons use the real rules, where the earlier drills don't", () => {
  for (const lesson of lessonsFor({ kind: "waza" })) assert.notEqual(createLessonDuel(lesson).options.basics, true, lesson.id);
  for (const round of SENSEI_ROUNDS) for (const lesson of round) assert.equal(createLessonDuel(lesson).options.basics, true, lesson.id);
});

test("parry: tapping on time passes, standing there doesn't", () => {
  assert.ok(play(wazaLesson("parry"), parrier, FULL_GEAR).passed);
  assert.ok(!play(wazaLesson("parry"), () => IDLE, FULL_GEAR).passed);
});

test("parry: holding block isn't a parry", () => {
  assert.ok(!play(wazaLesson("parry"), () => ({ ...IDLE, block: true }), FULL_GEAR).passed);
});

test("the parry lesson shows when to tap", () => {
  assert.equal(wazaLesson("parry").cue, true);
});

test("parry and counter: it takes both", () => {
  assert.ok(play(wazaLesson("parry-counter"), parryThenHit, FULL_GEAR).passed);
  assert.ok(!play(wazaLesson("parry-counter"), parrier, FULL_GEAR).passed);
});

test("lock, push: pushing through a held guard passes", () => {
  assert.ok(play(wazaLesson("lock-push"), pusher, FULL_GEAR).passed);
  assert.ok(!play(wazaLesson("lock-push"), () => IDLE, FULL_GEAR).passed);
});

test("lock, pull: cutting back from someone leaning on you passes, and you've got time to do it", () => {
  assert.ok(play(wazaLesson("lock-hiki"), puller, FULL_GEAR).passed);
  assert.ok(!play(wazaLesson("lock-hiki"), () => IDLE, FULL_GEAR).passed);
  assert.equal(createLessonDuel(wazaLesson("lock-hiki")).options.longLock, true);
});

test("lock, hold: stopping their pull passes, and just standing there doesn't", () => {
  assert.ok(play(wazaLesson("lock-hold"), holder, FULL_GEAR).passed);
  assert.ok(!play(wazaLesson("lock-hold"), () => IDLE, FULL_GEAR).passed);
});

test("crossing: swinging as they do passes", () => {
  assert.ok(play(wazaLesson("cross"), swinger, FULL_GEAR).passed);
  assert.ok(!play(wazaLesson("cross"), () => IDLE, FULL_GEAR).passed);
});

test("crossing and turning: it takes a strike from the new side", () => {
  assert.ok(play(wazaLesson("cross-turn"), crossThenHit, FULL_GEAR).passed);
  assert.ok(!play(wazaLesson("cross-turn"), swinger, FULL_GEAR).passed, "crossing alone isn't enough");
});

test("the short tutorial covers a strike, a tell, the parry, the lock and crossing, and it's short", () => {
  const quick = lessonsFor({ kind: "quick" });
  assert.deepEqual(quick.map((l) => l.id), ["quick-opening", "quick-strike", "quick-tell", "quick-parry", "quick-seme", "quick-push", "quick-hiki", "quick-cross"]);
  assert.ok(quick.every((l) => (l.reps ?? 1) === 1));
});

test("the short tutorial can be passed by doing what each step says", () => {
  const shows: (typeof IDLE.opening)[] = ["raise", "wrist", "drop"];
  const players: Record<string, Player> = {
    "quick-opening": (_duel, tick) => ({ ...IDLE, opening: shows[Math.floor(tick / 20) % 3] }),
    "quick-seme": () => ({ ...IDLE, seme: true }),
    "quick-strike": crossThenHit,
    "quick-tell": (duel) => {
      const after = follow(duel);
      if (after) return after;
      const [me, them] = duel.fighters;
      if (me.stance === "windup") return { ...IDLE, stomp: true };
      return them.stance === "windup" && them.stanceTicks > 30 && me.stance === "guard" ? { ...IDLE, attack: "kote", stomp: true } : IDLE;
    },
    "quick-parry": parrier,
    "quick-push": pusher,
    "quick-hiki": puller,
    "quick-cross": swinger,
  };
  for (const lesson of lessonsFor({ kind: "quick" })) assert.ok(play(lesson, players[lesson.id], FULL_GEAR).passed, lesson.id);
});

test("the short tutorial is run by its own person, and goes back to the multiplayer door", () => {
  assert.notEqual(partnerName({ kind: "quick" }), "Sensei");
  assert.equal(sessionPlace({ kind: "quick" }), "pinecone");
  assert.equal(sessionPartner({ kind: "waza" }), "sensei");
  assert.equal(partnerName({ kind: "waza" }), "Sensei");
});

/** A keyboard that's only ever got these keys down, and says which of them went down this frame. */
function keyboard(down: Set<Action>, before: Set<Action>): Input {
  return {
    isDown: (action) => down.has(action),
    wasPressed: (action) => down.has(action) && !before.has(action),
    typing: false,
    setTyping: () => {},
    typed: () => [],
    endTick: () => {},
    clear: () => {},
    dispose: () => {},
  };
}

test("every senpai names the opening to hold before the strike, as their card does (issue #11)", () => {
  const strikeKey = { men: "J", do: "L", kote: "K" } as const;
  for (const id of SENPAI_IDS) {
    for (const [level, target] of (["men", "do", "kote"] as const).entries()) {
      const prompt = challengeFor(id, level).prompt;
      const opening = prompt.search(/\b[Hh]old [WQE]\b/);
      assert.ok(opening >= 0, `${id}-${level} names no opening: ${prompt}`);
      assert.ok(prompt.indexOf(`${strikeKey[target]} and Space`) > opening, `${id}-${level} strikes before opening: ${prompt}`);
    }
  }
});

for (const id of ["aki", "bo"] as const) {
  test(`${id}'s first challenge passes by doing what the words say: hold E, wait for the moment, J and Space, slide through`, () => {
    const lesson = challengeFor(id, 0);
    let control = createPlayerControl();
    let before = new Set<Action>();
    const literal: Player = (duel) => {
      const down = new Set<Action>();
      const partner = duel.fighters[1];
      if (duel.phase === "zanshin") down.add("right");
      else if (distance(duel) > RANGE_MAX) down.add("right");
      else {
        down.add("drop");
        // Bo's words: wait for his guard to drop. Aki's: stay in range, so strike while she's in it.
        if (before.has("drop") && partner.stance !== "block" && duel.fighters[0].stance === "opening") down.add("men").add("stomp");
      }
      if (duel.phase !== "zanshin" && !down.has("drop")) control = createPlayerControl();
      const input = control(keyboard(down, before), duel.fighters[0]);
      before = down;
      return input;
    };
    const result = play(lesson, literal, BEFORE[0], 8000, { literal: true });
    assert.ok(result.passed, `${id}: reps ${result.reps}, misses ${result.misses}`);
  });
}

test("Yui's first challenge passes by doing exactly what she says, key for key (issue #11)", () => {
  const lesson = challengeFor("yui", 0);
  // Her words, in order: slide into range, hold E, then J and Space, then slide through.
  assert.match(lesson.prompt, /^Yui: Slide into range, hold E, then J and Space, exactly\. Then slide through!$/);
  let control = createPlayerControl();
  let before = new Set<Action>();
  let lastDuel: DuelState | null = null;
  let struck = false;
  const followTheText: Player = (duel) => {
    // Each rep starts over from her distance, so the words start over too.
    if (lastDuel && duel.fighters[0].x < lastDuel.fighters[0].x - 20) {
      control = createPlayerControl();
      struck = false;
    }
    lastDuel = duel;
    const down = new Set<Action>();
    if (duel.phase === "zanshin") down.add("right");
    else if (distance(duel) > RANGE_MAX) down.add("right");
    else {
      down.add("drop");
      // J and Space together, once, after E has gone down.
      if (before.has("drop") && !struck) {
        down.add("men").add("stomp");
        struck = true;
      }
    }
    const input = control(keyboard(down, before), duel.fighters[0]);
    before = down;
    return input;
  };
  const result = play(lesson, followTheText, BEFORE[0], 6000, { literal: true });
  assert.ok(result.passed, `reps ${result.reps}, misses ${result.misses}`);
  assert.equal(result.misses, 0);
});

test("Yui's first challenge words would fail without the opening, which is the bug in issue #11", () => {
  const lesson = challengeFor("yui", 0);
  const withoutOpening: Player = (duel) => {
    if (duel.phase === "zanshin") return { ...IDLE, move: 1 };
    if (distance(duel) > RANGE_MAX) return { ...IDLE, move: 1 };
    return { ...IDLE, attack: "men", stomp: true };
  };
  assert.equal(play(lesson, withoutOpening, BEFORE[0], 1500, { literal: true }).passed, false);
});

/**
 * Old Gen's last two stages, key for key from Gen's words: hold I, and at the moment let go,
 * hold the opening Gen names with the strike and Space together, then slide through.
 */
function genByTheWords(moment: (duel: DuelState) => boolean, opening: Action, strike: Action): Player {
  let control = createPlayerControl();
  let before = new Set<Action>();
  let struck = false;
  return (duel) => {
    const [me] = duel.fighters;
    const down = new Set<Action>();
    const going = me.stance === "opening" || me.stance === "windup";
    if (duel.phase === "zanshin") down.add("right");
    else if (going || moment(duel)) {
      down.add(opening);
      if (!struck) down.add(strike).add("stomp");
      struck = true;
    } else {
      struck = false;
      down.add("seme");
    }
    const input = control(keyboard(down, before), me, true);
    before = down;
    return input;
  };
}

test("Old Gen's words name the opening before each strike, as the cards do (issue #11, for seme)", () => {
  for (const [id, key] of [["seme-punish", "J"], ["seme-read", "L"]] as const) {
    const { prompt } = genStage(id);
    const opening = prompt.search(/\b[Hh]old [WQE]\b/);
    assert.ok(opening >= 0, `${id} names no opening: ${prompt}`);
    assert.ok(prompt.indexOf(`${key} and Space`) > opening, `${id} strikes before opening: ${prompt}`);
  }
});

test("stage two passes doing what Gen says: press until the flinch, let go, hold E, J and Space, slide through", () => {
  const player = genByTheWords((duel) => duel.fighters[1].stance === "shaken", "drop", "men");
  const result = play(genStage("seme-punish"), player, FULL_GEAR, 6000, { literal: true });
  assert.ok(result.passed, `reps ${result.reps}, misses ${result.misses}`);
});

test("stage three passes doing what Gen says: press until the arms go up, let go, hold W, L and Space, slide through", () => {
  const player = genByTheWords((duel) => duel.fighters[1].stance === "windup" && duel.fighters[1].attack === "bigMen", "raise", "do");
  const result = play(genStage("seme-read"), player, FULL_GEAR, 6000, { literal: true });
  assert.ok(result.passed, `reps ${result.reps}, misses ${result.misses}`);
});

test("Gen's flinch can't be punished without an opening, which is why the words have to name one", () => {
  const player = genByTheWords((duel) => duel.fighters[1].stance === "shaken", "seme", "men");
  assert.equal(play(genStage("seme-punish"), player, FULL_GEAR, 3000, { literal: true }).passed, false);
});
