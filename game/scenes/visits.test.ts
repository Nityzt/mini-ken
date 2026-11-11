import test from "node:test";
import assert from "node:assert/strict";
import { measureText, wrapText } from "../art/font.ts";
import { step, skipBow, createDuel, type FighterInput } from "../duel/rules.ts";
import { createRival, rivalAct, rivalConfig } from "../duel/rival.ts";
import { itemsGained, itemInfo } from "../items.ts";
import { currentObjective } from "../objective.ts";
import { techniques } from "../progress.ts";
import { createRunState, duelOptionsFor, recordLoss, type RunState } from "../run-state.ts";
import { readSave, SAVE_KEY, writeSave } from "../save.ts";
import { opponentById, REN_VISIT } from "../world/dojos.ts";
import type { NodeId } from "../world/map.ts";
import { DIALOGUE_LINES, DIALOGUE_WIDTH } from "./content.ts";
import { clubRows, CLUB_SOLID, findTiles, RIVAL_SOLID } from "./levels.ts";
import { REN_POINT_LESSON_AFTER } from "./content.ts";
import { challengeLines, dojoArrival, dojoVisitor, homeArrival, homeVisitor, learnGaze, lookAtRensThings, radishArrival, renPointOutcome, roomWithVisitor, talkToVisitor, VISITOR_SPOT } from "./visits.ts";
import { DOJOS } from "../world/dojos.ts";

const FULL = { tare: true, do: true, men: true, kote: true, shinai: true };
const firstDrillsDone = (): RunState => ({ ...createRunState(), metSenpai: true, gi: true, senseiRounds: 1, gear: { tare: true, do: false, men: false, kote: false, shinai: true } });
const bogu = (): RunState => ({ ...firstDrillsDone(), senseiRounds: 3, gear: FULL, trained: true });
const taught = (): RunState => ({ ...bogu(), gaze: true, seen: ["ren-tare", "ren-bogu"] });

test("nobody's visiting before your first drills are done", () => {
  assert.equal(homeVisitor(createRunState()), null);
  assert.equal(homeVisitor({ ...firstDrillsDone(), gear: { ...firstDrillsDone().gear, tare: false } }), null);
});

test("Ren drops in once you have your tare, and says so only once", () => {
  const run = firstDrillsDone();
  assert.equal(homeVisitor(run), "ren");
  const arrival = homeArrival(run);
  assert.ok(arrival);
  assert.ok(arrival.lines.some((line) => line.startsWith("Ren:")));
  assert.equal(arrival.fight, false);
  assert.equal(homeArrival(arrival.run), null);
});

test("Ren notices what's on your tare", () => {
  const plain = homeArrival(firstDrillsDone())!.lines.join(" ");
  const moon = homeArrival({ ...firstDrillsDone(), insignia: { symbol: "moon", cloth: "red", mark: "cream" } })!.lines.join(" ");
  assert.notEqual(plain, moon);
  assert.ok(moon.includes("moon"));
});

test("Ren says who they are before remarking on your tare", () => {
  const lines = homeArrival(firstDrillsDone())!.lines;
  const named = lines.findIndex((line) => line.includes("I'm Ren"));
  const tare = lines.findIndex((line) => line.includes("tare"));
  assert.ok(named >= 0 && tare > named, lines.join(" | "));
});

test("Ren is gone again once the next armor is earned, until the bogu is complete", () => {
  const run = firstDrillsDone();
  assert.equal(homeVisitor({ ...run, gear: { ...run.gear, do: true } }), null);
  assert.equal(homeVisitor({ ...run, gear: { ...run.gear, do: true, men: true } }), null);
});

test("with full bogu, Ren comes back and asks for one point", () => {
  const arrival = homeArrival(bogu());
  assert.ok(arrival);
  assert.equal(arrival.fight, true);
  assert.equal(homeVisitor(arrival.run), "ren");
});

test("backing out of Ren's point is allowed, and Ren waits", () => {
  const { run } = homeArrival(bogu())!;
  assert.equal(homeArrival(run), null);
  const talk = talkToVisitor(run);
  assert.equal(talk.fight, true);
  assert.ok(talk.lines.join(" ").length > 0);
});

test("after that point, walking back in plays Ren's lesson, and the gaze only comes at the end of it", () => {
  const afterMatch = renPointOutcome(bogu(), false);
  assert.equal(afterMatch.gaze, false);
  const lesson = homeArrival(afterMatch);
  assert.ok(lesson);
  assert.equal(lesson.teaches, true);
  assert.equal(lesson.fight, false);
  assert.ok(lesson.lines.join(" ").includes("Enzan no metsuke"));
  assert.ok(itemsGained(bogu(), learnGaze(afterMatch)).includes("gaze"));
});

test("refreshing in the middle of the lesson plays it again, rather than losing it", () => {
  const afterMatch = renPointOutcome(bogu(), false);
  assert.ok(homeArrival(homeArrival(afterMatch)!.run));
  assert.equal(homeVisitor(afterMatch), "ren");
  assert.equal(talkToVisitor(afterMatch).teaches, true);
});

test("once it's learned, there's no lesson left to play", () => {
  assert.equal(homeArrival(learnGaze(renPointOutcome(bogu(), false))), null);
});

test("somehow scoring on Ren still teaches it, with a different reaction", () => {
  const won = homeArrival(renPointOutcome(bogu(), true))!;
  const lost = homeArrival(renPointOutcome(bogu(), false))!;
  assert.equal(won.teaches, true);
  assert.notEqual(won.lines[0], lost.lines[0]);
});

test("that match never goes on the record", () => {
  const before = bogu();
  const run = renPointOutcome(before, false);
  assert.deepEqual(run.beaten, before.beaten);
  assert.deepEqual(run.losses, before.losses);
  assert.equal(run.bonusKi, before.bonusKi);
});

test("Ren stops waiting at home once you've taken the lesson", () => {
  assert.notEqual(homeVisitor(taught()), "ren");
});

test("a run that already beat Ren never sees the early visits", () => {
  assert.equal(homeVisitor({ ...firstDrillsDone(), beaten: ["radish"] }), null);
  assert.equal(homeVisitor({ ...bogu(), beaten: ["radish"] }), null);
});

test("Sora naps at your dojo once the door's open, until you've beaten Sora", () => {
  const open = { ...taught(), beaten: ["aki" as const] };
  assert.equal(homeVisitor(open), "sora");
  assert.equal(homeArrival(open), null);
  assert.ok(talkToVisitor(open).lines[0].startsWith("Sora:"));
  assert.equal(homeVisitor({ ...open, beaten: ["aki", "raccoon"] }), null);
});

test("Ren's lesson comes before Sora's nap", () => {
  assert.equal(homeVisitor({ ...bogu(), beaten: ["aki"] }), "ren");
});

test("the objective points at Ren while Ren's waiting, and moves on after", () => {
  assert.ok(currentObjective(bogu()).includes("Ren"));
  assert.ok(!currentObjective(taught()).includes("Ren"));
});

test("the next boss shows up at the dojo you just won, once, until you've beaten them too", () => {
  const won = { ...taught(), beaten: ["raccoon" as const] };
  assert.equal(dojoVisitor(won, "raccoon"), "goose");
  assert.equal(dojoVisitor(taught(), "raccoon"), null);
  assert.equal(dojoVisitor({ ...won, beaten: ["raccoon", "goose"] }, "raccoon"), null);
  const arrival = dojoArrival(won, "raccoon");
  assert.ok(arrival?.lines[0].startsWith("Hana:"));
  assert.equal(dojoArrival(arrival!.run, "raccoon"), null);
});

test("every boss but the last has someone waiting after them", () => {
  const all = { ...taught(), beaten: [] };
  assert.equal(dojoVisitor({ ...all, beaten: ["goose"] }, "goose"), "heron");
  assert.equal(dojoVisitor({ ...all, beaten: ["heron"] }, "heron"), "otter");
  assert.equal(dojoVisitor({ ...all, beaten: ["otter"] }, "otter"), "radish");
  assert.equal(dojoVisitor({ ...all, beaten: ["radish"] }, "radish"), null);
});

test("Ren's last visit depends on whether you ever took that lesson", () => {
  const withLesson = dojoArrival({ ...taught(), beaten: ["otter"] }, "otter")!.lines.join(" ");
  const without = dojoArrival({ ...bogu(), beaten: ["otter"] }, "otter")!.lines.join(" ");
  assert.notEqual(withLesson, without);
  assert.ok(without.includes("Pinecone"));
});

test("Ren greets you differently in the final if you learned the gaze", () => {
  const dojo = DOJOS.radish;
  assert.deepEqual(challengeLines(createRunState(), "radish"), dojo.challenge);
  assert.notDeepEqual(challengeLines({ ...createRunState(), gaze: true }, "radish"), dojo.challenge);
  assert.deepEqual(challengeLines({ ...createRunState(), gaze: true }, "goose"), DOJOS.goose.challenge);
});

test("a head you've beaten doesn't greet a rematch as if you'd never met", () => {
  for (const id of Object.keys(DOJOS) as (keyof typeof DOJOS)[]) {
    for (const gaze of [false, true]) {
      const first = challengeLines({ ...createRunState(), gaze }, id);
      const again = challengeLines({ ...createRunState(), gaze, beaten: [id] }, id);
      assert.notDeepEqual(again, first, id);
      for (const line of again) {
        assert.ok(line.startsWith(`${DOJOS[id].rival}: `), line);
        assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
      }
    }
  }
});

test("a head who beat you greets you as someone they've met, and still says the rules (owner, 2026-11-11)", () => {
  for (const id of Object.keys(DOJOS) as (keyof typeof DOJOS)[]) {
    if (id === "radish") continue;
    const first = challengeLines(createRunState(), id);
    const back = challengeLines({ ...createRunState(), losses: { [id]: 1 } }, id);
    assert.notEqual(back[0], first[0], id);
    assert.ok(back[0].startsWith(`${DOJOS[id].rival}: `), back[0]);
    assert.deepEqual(back.slice(1), DOJOS[id].challenge.slice(1), id);
    assert.match(back.join(" "), /Rei/, id);
    // A win resets the count, and then it's a rematch line, not a comeback.
    assert.deepEqual(challengeLines({ ...createRunState(), losses: { [id]: 0 }, beaten: [id] }, id), challengeLines({ ...createRunState(), beaten: [id] }, id));
    // Losing to someone else doesn't count.
    assert.deepEqual(challengeLines({ ...createRunState(), losses: { momo: 2 } }, id), first, id);
  }
});

test("visitors stand on open floor, and block nothing", () => {
  const rows = clubRows({ storageOpen: true, screenBroken: false, momoGuards: false, visitor: true });
  assert.equal(findTiles(rows, "V").length, 1);
  assert.ok(CLUB_SOLID.includes("V"));
  assert.ok(RIVAL_SOLID.includes("V"));
  assert.equal(findTiles(clubRows({ storageOpen: true, screenBroken: false, momoGuards: false }), "V").length, 0);
  for (const id of Object.keys(DOJOS) as (keyof typeof DOJOS)[]) {
    const { room } = DOJOS[id];
    assert.equal(room[VISITOR_SPOT.row][VISITOR_SPOT.col], ".", id);
    assert.equal(findTiles(roomWithVisitor(room), "V").length, 1, id);
  }
});

test("a visitor in a rival's dojo stands where the dialogue box won't hide them", () => {
  const STAGE_ROWS_ABOVE_BOX = 5;
  assert.ok(VISITOR_SPOT.row < STAGE_ROWS_ABOVE_BOX);
});

test("every line in the new story fits the dialogue box", () => {
  const talks = [
    ...[firstDrillsDone(), bogu()].flatMap((run) => [homeArrival(run)!.lines, talkToVisitor(homeArrival(run)!.run).lines]),
    talkToVisitor({ ...taught(), beaten: ["aki"] }).lines,
    homeArrival(renPointOutcome(bogu(), true))!.lines,
    homeArrival(renPointOutcome(bogu(), false))!.lines,
    challengeLines({ ...createRunState(), gaze: true }, "radish"),
    ...(["raccoon", "goose", "heron", "otter"] as const).map((host) => dojoArrival({ ...taught(), beaten: [host] }, host)!.lines),
    dojoArrival({ ...bogu(), beaten: ["otter"] }, "otter")!.lines,
  ];
  for (const lines of talks) for (const line of lines) assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
});

test("the gaze gets its own card and shows among your techniques", () => {
  const info = itemInfo("gaze");
  assert.ok(info.name.includes("gaze"));
  assert.ok(measureText(info.title) > 0);
  assert.ok(techniques(taught()).includes("gaze"));
  assert.ok(!techniques(bogu()).includes("gaze"));
});

test("a save remembers the lesson and what's been seen, and an old save still loads", () => {
  const memory = new Map<string, string>();
  const store = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) };
  writeSave(store, taught());
  const back = readSave(store)!;
  assert.equal(back.gaze, true);
  assert.deepEqual(back.seen, ["ren-tare", "ren-bogu"]);
  const { gaze: _gaze, seen: _seen, ...older } = createRunState();
  memory.set(SAVE_KEY, JSON.stringify({ version: 1, run: older }));
  assert.equal(readSave(store)?.gaze, false);
  assert.deepEqual(readSave(store)?.seen, []);
});

const IDLE: FighterInput = { move: 0, block: false, attack: null };

/** How long you can stand in Ren's reach, just holding your guard, before you flinch. */
function ticksToFlinch(run: RunState): number {
  let duel = skipBow(createDuel(duelOptionsFor(run)));
  for (let tick = 1; tick < 2000; tick++) {
    duel = step(duel, IDLE, IDLE);
    if (duel.events.some((event) => event.type === "shaken")) return tick;
  }
  return Infinity;
}

test("standing in guard, the gaze makes Ren's stare take twice as long to shake you", () => {
  const atRen = { ...createRunState(), node: "radish" as NodeId };
  const without = ticksToFlinch(atRen);
  const withGaze = ticksToFlinch({ ...atRen, gaze: true });
  assert.ok(without < 600, `${without}`);
  assert.ok(withGaze >= without * 1.9 && withGaze <= without * 2.1, `${withGaze} vs ${without}`);
});

/** How long you can hide behind your guard while Ren actively holds seme against you. */
function ticksToFlinchWhilePressed(run: RunState): number {
  let duel = skipBow(createDuel(duelOptionsFor(run)));
  for (let tick = 1; tick < 2000; tick++) {
    duel = step(duel, { ...IDLE, block: true }, { ...IDLE, seme: true });
    if (duel.events.some((event) => event.type === "shaken")) return tick;
  }
  return Infinity;
}

test("the gaze also helps when Ren actively presses you, though less, so hiding still doesn't pay", () => {
  const atRen = { ...createRunState(), node: "radish" as NodeId };
  const without = ticksToFlinchWhilePressed(atRen);
  const withGaze = ticksToFlinchWhilePressed({ ...atRen, gaze: true });
  assert.ok(without < 300, `${without}`);
  assert.ok(withGaze > without * 1.3, `${withGaze} vs ${without}`);
});

test("the gaze does nothing against anyone else's presence", () => {
  const atHome = { ...createRunState(), node: "pinecone" as NodeId };
  assert.deepEqual(duelOptionsFor({ ...atHome, gaze: true }).presence, duelOptionsFor(atHome).presence);
});

test("Ren easing off after three losses still means no stare at all", () => {
  let run: RunState = { ...createRunState(), node: "radish", gaze: true };
  for (let i = 0; i < 3; i++) run = recordLoss(run);
  assert.equal(duelOptionsFor(run).presence, undefined);
});

/** Plays Ren's one-point match to the end, however the player's bot behaves. */
function playVisit(player: (tick: number) => FighterInput, seed: number): { winner: 0 | 1 | null; ticks: number } {
  let duel = skipBow(createDuel(duelOptionsFor(createRunState(), "renVisit")));
  let rival = createRival(seed, rivalConfig(0, REN_VISIT.style));
  for (let tick = 0; tick < 60 * 90; tick++) {
    const act = rivalAct(duel, rival);
    rival = act.rival;
    duel = step(duel, player(tick), act.input);
    if (duel.phase === "over") return { winner: duel.winner, ticks: tick };
  }
  return { winner: null, ticks: Infinity };
}

test("Ren's one point is over fast, whether you stand still, hide, or walk away", () => {
  const players: Record<string, (tick: number) => FighterInput> = {
    "stands still": () => IDLE,
    hides: () => ({ ...IDLE, block: true }),
    "walks away": () => ({ ...IDLE, move: -1 }),
    "walks in": () => ({ ...IDLE, move: 1 }),
  };
  for (const [name, player] of Object.entries(players)) {
    for (let seed = 1; seed <= 5; seed++) {
      const { winner, ticks } = playVisit(player, seed);
      assert.equal(winner, 1, name);
      assert.ok(ticks < 60 * 20, `${name} took ${ticks}`);
    }
  }
});

test("mashing strikes doesn't take the point from Ren either", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const { winner } = playVisit((tick) => ({ move: 1, block: false, attack: tick % 20 === 0 ? "men" : null, stomp: tick % 20 === 0 }), seed);
    assert.equal(winner, 1);
  }
});

test("Ren's visit is one point, and Ren's own ki is out of reach", () => {
  const options = duelOptionsFor(createRunState(), "renVisit");
  assert.equal(options.pointsToWin, 1);
  assert.equal(opponentById("renVisit").rival, "Ren");
  assert.ok(options.kiMax![1] > 200);
  assert.ok(options.presence![1] > 1);
});

test("everyone else still fights to two", () => {
  assert.equal(duelOptionsFor(createRunState(), "aki").pointsToWin, undefined);
});

test("Ren hands over the gaze, and only then tells you where you'll need it", () => {
  const lesson = homeArrival(renPointOutcome(bogu(), false))!;
  assert.match(lesson.lines.at(-1)!, /for free/);
  assert.deepEqual(lesson.after, REN_POINT_LESSON_AFTER);
  assert.ok(!lesson.lines.some((line) => REN_POINT_LESSON_AFTER.includes(line)));
});

test("Sora, woken at Pinecone, rolls over after the first time and remembers you at Sleepy Raccoon", () => {
  const home = { ...createRunState(), trained: true, gear: { ...createRunState().gear, shinai: true, tare: true, do: true, men: true, kote: true }, beaten: ["aki"] as RunState["beaten"], linePasses: 3, gaze: true };
  assert.equal(homeVisitor(home), "sora");
  assert.match(challengeLines(home, "raccoon")[0], /A visitor/);
  const woken = talkToVisitor(home);
  assert.equal(woken.lines.length, 2);
  const again = talkToVisitor(woken.run);
  assert.equal(again.lines.length, 1);
  assert.doesNotMatch(again.lines[0], /kettle/);
  const at = challengeLines(again.run, "raccoon");
  assert.match(at[0], /from Pinecone/);
  assert.equal(at.length, challengeLines(home, "raccoon").length);
});

// Ren hidden below Thunder Radish (owner, 2026-11-11).
const readyForRen = (): RunState => ({ ...taught(), node: "radish", beaten: ["aki", "raccoon", "goose", "heron", "otter"], seme: true, dan: 3, waza: true, linePasses: 3, bonusKi: 200 });

test("walking into Thunder Radish once you're good enough, Ren's spot is empty, and that's said once", () => {
  const first = radishArrival(readyForRen());
  assert.ok(first && first.lines.join(" ").includes("empty"));
  assert.equal(radishArrival(first.run), null);
  assert.equal(radishArrival({ ...readyForRen(), beaten: [...readyForRen().beaten, "radish"] }), null);
  assert.equal(radishArrival({ ...readyForRen(), seme: false }), null);
});

test("Ren's things point at Raiko, and looking at them counts as finding Ren gone", () => {
  const looked = lookAtRensThings(readyForRen());
  assert.ok(looked.lines.join(" ").includes("Raiko"));
  assert.equal(radishArrival(looked.run), null);
});

test("Ren stops watching at Soggy Otter once you've found Ren gone from Thunder Radish", () => {
  const atOtter = { ...readyForRen(), node: "otter" as NodeId };
  assert.equal(dojoVisitor(atOtter, "otter"), "radish");
  assert.equal(dojoVisitor(radishArrival(readyForRen())!.run, "otter"), null);
  // The visit right after Kenji still says where to go, and hints nobody might be home.
  assert.match(dojoArrival(atOtter, "otter")!.lines.join(" "), /Thunder Radish/);
});

test("every new Ren and Raiko line fits the dialogue box", () => {
  const lines = [...radishArrival(readyForRen())!.lines, ...lookAtRensThings(readyForRen()).lines];
  for (const line of lines) assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
});
