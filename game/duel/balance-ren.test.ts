import test from "node:test";
import assert from "node:assert/strict";
import { RANGE_MAX, RANGE_MIN } from "./constants.ts";
import { createRival, rivalAct, withMood } from "./rival.ts";
import { createDuel, distance, exposedTargets, skipBow, step, type DuelState, type FighterInput } from "./rules.ts";
import { createRunState, duelOptionsFor, recordLoss, rivalConfigFor, type RunState } from "../run-state.ts";

// Ren, the last dojo, played at the ki you'd really have by then, with the moods the game rolls.
// The late-game playtest found a player who never pressed beat Ren even with half-second reactions,
// because Ren's stare took longer to fold you than Ren took to show a readable opening.

const IDLE: FighterInput = { move: 0, block: false, attack: null };
const MATCHES = 20;
/** Ticks are 25ms, so 12 is a quick 300ms and 20 is the half second the playtest's player took. */
const REACTIONS = [12, 20];
/** The least the door to Ren lets you in with, and what a thorough player brings: the tsuba and more. */
const AT_THE_DOOR = { bonusKi: 130, hasTsuba: false };
const THOROUGH = { bonusKi: 160, hasTsuba: true };

type Waits = "guard" | "block" | "seme";
/** Answers each opening Ren shows after `react` ticks, and punishes anyone left open. In between it stands, hides, or presses. */
const reader = (react: number, waits: Waits) => {
  let watching: string | null = null;
  let seenFor = 0;
  return (duel: DuelState): FighterInput => {
    const [me, ren] = duel.fighters;
    const dist = distance(duel);
    const tell = ren.stance === "windup" || ren.stance === "opening" ? exposedTargets(ren)[0] : null;
    if (tell !== watching) {
      watching = tell;
      seenFor = 0;
    } else if (tell) seenFor++;
    if (dist > RANGE_MAX - 2) return { ...IDLE, move: 1 };
    if (dist < RANGE_MIN + 4) return { ...IDLE, move: -1 };
    if (me.queued) return { ...IDLE, stomp: true };
    if (tell && seenFor >= react) return { ...IDLE, opening: "wrist", attack: tell, stomp: true };
    const open = ren.stance === "recovery" || ren.stance === "shaken" || ren.stance === "broken";
    if (open && ren.stanceTicks > 8) return { ...IDLE, opening: "wrist", attack: "men", stomp: true };
    if (waits === "seme") return me.ki > 30 ? { ...IDLE, seme: true } : IDLE;
    if (me.ki < 70 && !tell) return IDLE;
    return waits === "block" ? { ...IDLE, block: true } : IDLE;
  };
};

function wins(waits: Waits, react: number, run: RunState, final = false): number {
  let won = 0;
  for (let seed = 1; seed <= MATCHES; seed++) {
    const me = reader(react, waits);
    let duel = skipBow(createDuel(duelOptionsFor(run, "radish", final)));
    let rival = createRival(seed, withMood(rivalConfigFor(run, "radish", final), seed ^ 0x5bd1e995));
    for (let t = 0; t < 9000 && duel.phase !== "over"; t++) {
      const act = rivalAct(duel, rival);
      rival = act.rival;
      let input = me(duel);
      if (duel.phase === "zanshin" && duel.zanshin?.by === 0) input = { ...input, move: duel.zanshin.dir };
      duel = step(duel, input, act.input);
    }
    if (duel.winner === 0) won++;
  }
  return won;
}

const ladder = (extra: Partial<RunState>, losses = 0): RunState => {
  let run: RunState = { ...createRunState(), node: "radish", dan: 3, seme: true, ...extra };
  for (let i = 0; i < losses; i++) run = recordLoss(run, "radish");
  return run;
};

for (const gaze of [false, true]) {
  const known = gaze ? "with the far-mountain gaze" : "without the gaze";
  test(`Ren: reading tells without seme usually loses, ${known}`, () => {
    for (const strength of [AT_THE_DOOR, THOROUGH])
      for (const react of REACTIONS)
        for (const waits of ["guard", "block"] as Waits[]) {
          const won = wins(waits, react, ladder({ ...strength, gaze }));
          assert.ok(won <= 4, `${waits}, ${react * 25}ms, ki +${strength.bonusKi}: won ${won} of ${MATCHES}`);
        }
  });
  test(`Ren: holding seme while reading tells has a fair chance, ${known}`, () => {
    for (const react of REACTIONS) {
      const won = wins("seme", react, ladder({ ...AT_THE_DOOR, gaze }));
      assert.ok(won >= 8, `${react * 25}ms: won ${won} of ${MATCHES}`);
    }
  });
}

test("Ren: after three losses, reading tells is enough, however slowly", () => {
  for (const react of [...REACTIONS, 28]) {
    const won = wins("guard", react, ladder(AT_THE_DOOR, 3));
    assert.ok(won >= 11, `${react * 25}ms: won ${won} of ${MATCHES}`);
  }
});

test("Ren: the Taikai final never eases off, so it still wants seme", () => {
  const lostOften = ladder({ ...THOROUGH, gaze: true }, 6);
  for (const react of REACTIONS) {
    const without = wins("guard", react, lostOften, true);
    const pressing = wins("seme", react, lostOften, true);
    assert.ok(without <= 4, `${react * 25}ms without seme: won ${without} of ${MATCHES}`);
    assert.ok(pressing >= 8, `${react * 25}ms with seme: won ${pressing} of ${MATCHES}`);
  }
});
