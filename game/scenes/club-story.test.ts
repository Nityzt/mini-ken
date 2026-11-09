import test from "node:test";
import assert from "node:assert/strict";
import { answerOffer, cupOffer, doorResponse, finishSession, freeSenpai, freeSenpaiNames, interactionLabel, kirikaeshiOutcome, lineOutcome, lineOffer, pendingChallenge, senseiMenu, sparOutcome, talkToMomo, talkToSenpai, talkToSensei } from "./club-story.ts";
import { recordLinePass, recordWin } from "../run-state.ts";
import { isOpen, LINE_PASSES_TO_UNLOCK } from "../progress.ts";
import { DIALOGUE_LINES, DIALOGUE_WIDTH, DRILL_PRAISE, GEAR_LINES, GEN_DONE, GEN_DONE_AFTER, KOTE_DONE, SENPAI_LINES, SENSEI_ROUND_DONE } from "./content.ts";
import { wrapText } from "../art/font.ts";
import { createRunState, type RunState } from "../run-state.ts";

const withGi = (): RunState => ({ ...createRunState(), metSenpai: true, gi: true });
const armored = (): RunState => ({ ...withGi(), trained: true, gear: { tare: true, do: true, men: true, kote: true, shinai: true } });

test("a new player has street clothes and nothing else", () => {
  const run = createRunState();
  assert.equal(run.metSenpai, false);
  assert.equal(run.gi, false);
  assert.equal(Object.values(run.gear).some(Boolean), false);
});

test("Momo's first talk leads to a walk to storage, and the walk is what unlocks it", () => {
  const first = talkToMomo(createRunState());
  assert.equal(first.escort, true);
  assert.equal(first.run.metSenpai, false);
  assert.equal(first.run.gi, false);
  // Walking away without the walk means she offers again.
  assert.equal(talkToMomo(first.run).escort, true);
});

test("Momo keeps pointing at storage until you have the gi", () => {
  const first = talkToMomo(createRunState());
  const second = talkToMomo({ ...first.run, metSenpai: true });
  assert.equal(second.escort, undefined);
  assert.notDeepEqual(second.lines, first.lines);
  assert.ok(second.lines.join(" ").includes("storage"));
});

test("Momo sends you to Sensei once you have the gi", () => {
  assert.ok(talkToMomo(withGi()).lines.join(" ").includes("Sensei"));
});

test("Sensei won't see you in street clothes", () => {
  const start = createRunState();
  const reply = talkToSensei(start);
  assert.equal(reply.session, null);
  assert.equal(reply.run.gear.shinai, false);
  assert.deepEqual(reply.run, start);
});

test("Sensei lends their old shinai and starts the first round, once you've earned it", () => {
  const reply = answerOffer({ ...withGi(), whyKendo: "cool" }, "yes");
  assert.equal(reply.run.gear.shinai, true);
  assert.deepEqual(reply.session, { kind: "sensei", round: 0 });
  assert.equal(reply.run.gear.tare, false);
});

test("Sensei restarts the round if you have the shinai but haven't finished it", () => {
  const start = { ...withGi(), gear: { ...withGi().gear, shinai: true } };
  assert.deepEqual(talkToSensei(start).session, { kind: "sensei", round: 0 });
});

const afterRound = (run: RunState, round: number): RunState => finishSession(run, { kind: "sensei", round }).run;
const shinai = (): RunState => ({ ...withGi(), gear: { ...withGi().gear, shinai: true } });

test("the first round ends with just a tare", () => {
  const run = afterRound(shinai(), 0);
  assert.deepEqual(run.gear, { tare: true, do: false, men: false, kote: false, shinai: true });
});

test("the armor loop runs Sensei, senpai, Sensei, senpai, until the kote", () => {
  let run = afterRound(shinai(), 0);
  // Sensei has nothing new until a senpai's challenge is passed.
  assert.equal(talkToSensei(run).session, null);
  assert.equal(pendingChallenge(run), 0);
  assert.deepEqual(talkToSenpai(run, "aki").session, { kind: "senpai", senpai: "aki", level: 0 });

  run = finishSession(run, { kind: "senpai", senpai: "aki", level: 0 }).run;
  assert.equal(run.gear.do, true);
  assert.equal(run.gear.men, false);
  assert.equal(pendingChallenge(run), null);
  assert.equal(talkToSenpai(run, "bo").session, null);
  assert.deepEqual(talkToSensei(run).session, { kind: "sensei", round: 1 });

  run = afterRound(run, 1);
  assert.equal(run.gear.men, false);
  assert.equal(talkToSensei(run).session, null);
  run = finishSession(run, { kind: "senpai", senpai: "bo", level: 1 }).run;
  assert.equal(run.gear.men, true);
  assert.deepEqual(talkToSensei(run).session, { kind: "sensei", round: 2 });

  run = afterRound(run, 2);
  assert.equal(run.trained, false);
  run = finishSession(run, { kind: "senpai", senpai: "yui", level: 2 }).run;
  assert.equal(run.gear.kote, true);
  assert.equal(run.trained, true);
  assert.equal(talkToSensei(run).session, null);
});

test("no senpai offers a challenge before Sensei's first round", () => {
  for (const id of ["aki", "bo", "yui"] as const) assert.equal(talkToSenpai(withGi(), id).session, null);
});

test("a rival dojo's sensei is someone you can walk up to", () => {
  assert.equal(interactionLabel("X", "rival"), "Talk");
});

test("every senpai has something to say at every stage", () => {
  for (const id of ["aki", "bo", "yui"] as const) {
    assert.ok(talkToSenpai(withGi(), id).lines.length > 0);
    assert.ok(talkToSenpai(afterRound(shinai(), 0), id).lines.length > 0);
    assert.ok(talkToSenpai(armored(), id).lines.length > 0);
  }
});

test("after full armor, Sensei says what's next and offers the line drill", () => {
  const reply = talkToSensei(armored());
  assert.equal(reply.session, null);
  assert.equal(reply.menu, true);
  assert.ok(reply.lines.join(" ").includes("beat a senpai"));
  const next = talkToSensei(recordWin(armored(), "aki"));
  assert.ok(next.lines.join(" ").includes("line drill 0/3"));
});

test("Sensei only offers the line drill once you're fully armored", () => {
  assert.ok(!talkToSensei(withGi()).menu);
  assert.ok(!talkToSensei(afterRound(shinai(), 0)).menu);
});

test("Sensei still has something to say when everything's open", () => {
  const run = { ...armored(), beaten: ["aki", "radish"] as RunState["beaten"], linePasses: 9, bonusKi: 99, seme: true };
  assert.ok(talkToSensei(run).lines.length > 0);
});

test("the door needs full armor and a win over a senpai", () => {
  assert.equal(doorResponse(createRunState()).leaves, false);
  assert.equal(doorResponse(withGi()).leaves, false);
  assert.equal(doorResponse(afterRound(shinai(), 0)).leaves, false);
  assert.equal(doorResponse(armored()).leaves, false);
  assert.ok(doorResponse(armored()).lines.join(" ").includes("Aki"));
  assert.equal(doorResponse(recordWin(armored(), "aki")).leaves, true);
});

test("the door's reason changes once you're armored", () => {
  assert.notDeepEqual(doorResponse(withGi()).lines, doorResponse(armored()).lines);
});

test("once you're fully armored, every senpai will spar", () => {
  for (const id of ["aki", "bo", "yui"] as const) {
    const reply = talkToSenpai(armored(), id);
    assert.equal(reply.fight, id);
    assert.equal(reply.session, null);
  }
});

test("nobody offers a real match before you're fully armored", () => {
  for (const id of ["aki", "bo", "yui"] as const) {
    assert.ok(!talkToSenpai(withGi(), id).fight);
    assert.ok(!talkToSenpai(afterRound(shinai(), 0), id).fight);
  }
});

test("earning the kote tells you what the door needs next, once you've seen the kote", () => {
  const start = { ...shinai(), senseiRounds: 3, gear: { tare: true, do: true, men: true, kote: false, shinai: true } };
  const reply = finishSession(start, { kind: "senpai", senpai: "bo", level: 2 });
  assert.equal(reply.run.trained, true);
  assert.deepEqual(reply.lines, [SENPAI_LINES.bo.pass]);
  assert.equal(reply.after, undefined, "Sensei isn't in the room with you and Bo");
  assert.deepEqual(reply.home, [KOTE_DONE]);
});

test("the tare is handed over before Sensei sends you on to a senpai", () => {
  const reply = finishSession(shinai(), { kind: "sensei", round: 0 });
  assert.deepEqual(reply.lines, [DRILL_PRAISE.tare]);
  assert.deepEqual(reply.after, [SENSEI_ROUND_DONE[0]("Aki, Bo or Yui")]);
});

test("the do and men have nothing to say after they're handed over", () => {
  for (const level of [0, 1]) {
    const reply = finishSession({ ...shinai(), senseiRounds: level + 1 }, { kind: "senpai", senpai: "aki", level });
    assert.deepEqual(reply.lines, [SENPAI_LINES.aki.pass]);
    assert.equal(reply.after, undefined);
  }
});

test("Sensei hands over the shinai, and only then asks for drills", () => {
  const reply = answerOffer({ ...withGi(), whyKendo: "cool" }, "yes");
  assert.match(reply.lines.at(-1)!, /loan/);
  assert.equal(reply.after?.length, 1);
  assert.match(reply.after![0], /Show me some drills/);
});

test("the shinai's own card explains it, so Sensei doesn't read it out as well", () => {
  const reply = answerOffer({ ...withGi(), whyKendo: "cool" }, "yes");
  assert.ok(![...reply.lines, ...reply.after!].includes(GEAR_LINES.shinai));
});

test("a senpai win says the door's open the first time", () => {
  const first = sparOutcome(armored(), "aki");
  assert.equal(isOpen(first.run, "door"), true);
  assert.equal(first.run.beaten.includes("aki"), true);
  const again = sparOutcome(first.run, "aki");
  assert.notDeepEqual(again.lines, first.lines);
  assert.equal(again.run.bonusKi, first.run.bonusKi);
});

test("a second senpai still pays out ki, without announcing the door again", () => {
  const first = sparOutcome(armored(), "aki");
  const second = sparOutcome(first.run, "bo");
  assert.equal(second.run.bonusKi, first.run.bonusKi + 5);
  assert.ok(!second.lines.join(" ").includes("door"));
});

test("passing the line drill counts, and the third pass opens the streets", () => {
  let run = armored();
  for (let i = 1; i <= LINE_PASSES_TO_UNLOCK; i++) {
    const reply = lineOutcome(run, { passed: true, cleans: 4, count: 4 });
    assert.equal(reply.run.linePasses, i);
    if (i === LINE_PASSES_TO_UNLOCK) assert.ok(reply.lines.join(" ").includes("streets"));
    else assert.ok(reply.lines.join(" ").includes(`${i}`));
    run = reply.run;
  }
});

test("failing the line drill costs nothing and says how it went", () => {
  const reply = lineOutcome(armored(), { passed: false, cleans: 2, count: 5 });
  assert.equal(reply.run.linePasses, 0);
  assert.equal(reply.run.bonusKi, 0);
  assert.ok(reply.lines.join(" ").includes("2 of 5"));
});

test("runs beyond the third still get a word from Sensei", () => {
  const run = { ...armored(), linePasses: LINE_PASSES_TO_UNLOCK };
  assert.ok(lineOutcome(run, { passed: true, cleans: 5, count: 5 }).lines.length > 0);
  assert.equal(recordLinePass(run).linePasses, LINE_PASSES_TO_UNLOCK + 1);
});

test("the last tier warns you the key prompts are gone", () => {
  assert.notDeepEqual(lineOffer({ ...armored(), linePasses: 0 }), lineOffer({ ...armored(), linePasses: 2 }));
  assert.ok(lineOffer({ ...armored(), linePasses: 2 }).join(" ").includes("no key"));
});

test("the line drill's words fit in the dialogue box", () => {
  for (let passes = 0; passes < 5; passes++) {
    const lines = [
      ...lineOffer({ ...armored(), linePasses: passes }),
      ...lineOutcome({ ...armored(), linePasses: passes }, { passed: true, cleans: 5, count: 5 }).lines,
      ...lineOutcome({ ...armored(), linePasses: passes }, { passed: false, cleans: 0, count: 5 }).lines,
    ];
    for (const line of lines) assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
  }
});

test("Momo challenges you only once you're fully armored, and stops once beaten", () => {
  assert.equal(talkToMomo(withGi()).fight, false);
  assert.equal(talkToMomo(armored()).fight, true);
  assert.equal(talkToMomo({ ...armored(), momoBeaten: true }).fight, false);
});

test("Momo talks differently once you've learned seme", () => {
  assert.notDeepEqual(talkToMomo(armored()).lines, talkToMomo({ ...armored(), seme: true }).lines);
});

test("Old Gen hands over seme, and explains what it costs once you've seen the card", () => {
  const reply = finishSession(armored(), { kind: "master" });
  assert.deepEqual(reply.lines, GEN_DONE);
  assert.match(reply.lines.at(-1)!, /yours/);
  assert.deepEqual(reply.after, GEN_DONE_AFTER);
  assert.ok(reply.after!.join(" ").includes("Space"));
  assert.ok(reply.after!.join(" ").includes("costs ki"));
});

test("Old Gen's words about seme fit the dialogue box", () => {
  for (const line of [...GEN_DONE, ...GEN_DONE_AFTER]) assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
});

test("learning from the hermit gives you seme", () => {
  const run = armored();
  assert.equal(run.seme, false);
  assert.equal(finishSession(run, { kind: "master" }).run.seme, true);
});

test("the notice board says what it takes while a cup is shut", () => {
  const offer = cupOffer(createRunState(), "pinecone");
  assert.equal(offer.enter, false);
  assert.match(offer.lines[0], /Still to do/);
});

test("the notice board offers the cup once it's open, and mentions the prize only while there is one", () => {
  const open = { ...createRunState(), linePasses: 3, beaten: ["aki"] as RunState["beaten"] };
  const offer = cupOffer(open, "pinecone");
  assert.equal(offer.enter, true);
  assert.ok(offer.lines.join(" ").includes("Pinecone Cup"));
  assert.ok(offer.lines.join(" ").includes("+15"));
  const won = cupOffer({ ...open, cups: ["pinecone"] }, "pinecone");
  assert.equal(won.enter, true);
  assert.ok(!won.lines.join(" ").includes("+15"));
});

test("people and things say what pressing E will do", () => {
  assert.equal(interactionLabel("M", "home"), "Talk");
  assert.equal(interactionLabel("X", "home"), "Talk");
  assert.equal(interactionLabel("N", "home"), "Notice board");
  assert.equal(interactionLabel("D", "home"), "Leave");
  assert.equal(interactionLabel("R", "rival"), "Talk");
  assert.equal(interactionLabel("G", "rival"), "Talk");
  assert.equal(interactionLabel("D", "rival"), "Leave");
  assert.equal(interactionLabel(".", "home"), null);
  assert.equal(interactionLabel("#", "rival"), null);
});

test("the same tile letter can mean different things at home and away", () => {
  assert.equal(interactionLabel("G", "home"), null, "at home, G is the spare gi, which you walk onto");
});

test("Sensei offers the waza lesson once you're armored", () => {
  const armored = { ...createRunState(), trained: true };
  assert.ok(senseiMenu(armored).some((o) => o.id === "waza"));
});

test("finishing the waza lesson is recorded and pays, once", () => {
  const start = createRunState();
  const first = finishSession(start, { kind: "waza" });
  assert.equal(first.run.waza, true);
  assert.ok(first.run.xp > start.xp);
  const again = finishSession(first.run, { kind: "waza" });
  assert.equal(again.run, first.run);
});

test("the short tutorial changes nothing about a story run", () => {
  const start = createRunState();
  assert.equal(finishSession(start, { kind: "quick" }).run, start);
});

test("kirikaeshi is on Sensei's menu", () => {
  assert.ok(senseiMenu(createRunState()).some((o) => o.id === "kirikaeshi"));
});

test("the first three kirikaeshi passes grow your ki, and later ones only count as practice", () => {
  let run = createRunState();
  const kiAt: number[] = [];
  for (let i = 0; i < 4; i++) {
    run = kirikaeshiOutcome(run, { outcome: "passed", misses: 0, onBeat: i * 6 }).run;
    kiAt.push(run.bonusKi);
  }
  assert.deepEqual(kiAt, [5, 10, 15, 15]);
  assert.equal(run.kirikaeshiPasses, 4);
  assert.ok(run.xp > 0);
});

test("a failed kirikaeshi costs nothing and earns nothing", () => {
  const run = createRunState();
  for (const outcome of ["winded", "lost"] as const) {
    const reply = kirikaeshiOutcome(run, { outcome, misses: 2, onBeat: 18 });
    assert.equal(reply.run, run);
    assert.equal(reply.lines.length, 1);
  }
});

test("each way of failing kirikaeshi gets its own advice", () => {
  const run = createRunState();
  const lines = (["winded", "lost"] as const).map((outcome) => kirikaeshiOutcome(run, { outcome, misses: 2, onBeat: 0 }).lines[0]);
  assert.equal(new Set(lines).size, 2);
});

test("a slow kirikaeshi pass earns exactly what one on Bo's beat does, and Sensei says how the rhythm went", () => {
  const run = createRunState();
  const slow = kirikaeshiOutcome(run, { outcome: "passed", misses: 1, onBeat: 0 });
  const quick = kirikaeshiOutcome(run, { outcome: "passed", misses: 1, onBeat: 18 });
  assert.deepEqual(slow.run, quick.run);
  assert.doesNotMatch(slow.lines[0], /beat/);
  assert.match(kirikaeshiOutcome(run, { outcome: "passed", misses: 1, onBeat: 7 }).lines[0], /7 of 18 on Bo's beat/);
  assert.match(quick.lines[0], /Every men on Bo's beat/);
});

/** Sensei's taught the round for this piece, and nobody has passed you for it yet. */
const waitingFor = (level: number, armorFrom: RunState["armorFrom"]): RunState => {
  const pieces = ["do", "men", "kote"] as const;
  const gear = { ...shinai().gear, tare: true };
  for (const piece of pieces.slice(0, level)) gear[piece] = true;
  return { ...shinai(), senseiRounds: level + 1, gear, armorFrom };
};

test("each piece of armor is recorded against the senpai who gave it", () => {
  let run = finishSession(waitingFor(0, {}), { kind: "senpai", senpai: "bo", level: 0 }).run;
  assert.deepEqual(run.armorFrom, { do: "bo" });
  run = finishSession({ ...run, senseiRounds: 2 }, { kind: "senpai", senpai: "yui", level: 1 }).run;
  assert.deepEqual(run.armorFrom, { do: "bo", men: "yui" });
});

test("a senpai who's already given you a piece won't test you for another, but still talks", () => {
  const run = waitingFor(1, { do: "aki" });
  const aki = talkToSenpai(run, "aki");
  assert.equal(aki.session, null);
  assert.equal(aki.fight, undefined);
  assert.deepEqual(aki.lines, [SENPAI_LINES.aki.given("do", "Bo or Yui")]);
  assert.deepEqual(talkToSenpai(run, "bo").session, { kind: "senpai", senpai: "bo", level: 1 });
  assert.deepEqual(talkToSenpai(run, "yui").session, { kind: "senpai", senpai: "yui", level: 1 });
});

test("the last piece can only come from the senpai nobody's used yet", () => {
  const run = waitingFor(2, { do: "yui", men: "aki" });
  assert.equal(talkToSenpai(run, "yui").session, null);
  assert.equal(talkToSenpai(run, "aki").session, null);
  assert.match(talkToSenpai(run, "aki").lines[0], /Bo/);
  assert.deepEqual(talkToSenpai(run, "bo").session, { kind: "senpai", senpai: "bo", level: 2 });
});

test("all three senpai in any order earn the full armor", () => {
  for (const order of [["aki", "bo", "yui"], ["yui", "aki", "bo"], ["bo", "yui", "aki"]] as const) {
    let run = afterRound(shinai(), 0);
    order.forEach((senpai, level) => {
      for (const used of order.slice(0, level)) assert.equal(talkToSenpai(run, used).session, null, `${used} again at level ${level}`);
      const session = talkToSenpai(run, senpai).session;
      assert.deepEqual(session, { kind: "senpai", senpai, level });
      run = finishSession(run, session!).run;
      if (level < 2) run = afterRound(run, level + 1);
    });
    assert.equal(run.trained, true);
    assert.deepEqual(new Set(Object.values(run.armorFrom)), new Set(order));
  }
});

test("Sensei and the objective name only the senpai still left to pass", () => {
  assert.match(talkToSensei(waitingFor(0, {})).lines[0], /Aki, Bo or Yui/);
  const second = talkToSensei(waitingFor(1, { do: "bo" })).lines[0];
  assert.match(second, /Aki or Yui/);
  assert.doesNotMatch(second, /Bo/);
  assert.match(talkToSensei(waitingFor(2, { do: "bo", men: "aki" })).lines[0], /: Yui\./);
  // Finishing Sensei's round names who's left for the piece it leads to.
  const done = finishSession({ ...waitingFor(1, { do: "aki" }), gear: { ...waitingFor(1, {}).gear }, senseiRounds: 1 }, { kind: "sensei", round: 1 });
  assert.match(done.lines[0], /Bo or Yui/);
  assert.equal(freeSenpaiNames(waitingFor(1, { do: "aki" })), "Bo or Yui");
});

test("sparring after the armor is open with every senpai, whoever gave you what", () => {
  const run: RunState = { ...armored(), armorFrom: { do: "aki", men: "bo", kote: "yui" } };
  for (const id of ["aki", "bo", "yui"] as const) assert.equal(talkToSenpai(run, id).fight, id);
});

test("older saves with nobody on record leave every senpai free", () => {
  // Saves from before this rule have their armor but no record of who gave it.
  const run = waitingFor(2, {});
  assert.deepEqual(freeSenpai(run), ["aki", "bo", "yui"]);
  for (const id of ["aki", "bo", "yui"] as const) assert.deepEqual(talkToSenpai(run, id).session, { kind: "senpai", senpai: id, level: 2 });
});

test("a record that reuses a senpai, or names all three, never strands the player", () => {
  // One senpai on record twice: the other two are still free for the last piece.
  assert.deepEqual(freeSenpai(waitingFor(2, { do: "aki", men: "aki" })), ["bo", "yui"]);
  // Somehow all three on record with a piece still to earn: anyone will do, rather than nobody.
  const stuck = { ...waitingFor(2, {}), armorFrom: { do: "aki", men: "bo", kote: "yui" } } as RunState;
  assert.deepEqual(freeSenpai(stuck), ["aki", "bo", "yui"]);
  assert.deepEqual(talkToSenpai(stuck, "aki").session, { kind: "senpai", senpai: "aki", level: 2 });
});
