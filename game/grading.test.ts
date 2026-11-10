import test from "node:test";
import assert from "node:assert/strict";
import { askToGrade, canUseTicketIn, gradingOutcome, gradingPartner, gradingReady, hasTicket, kihonOutcome, payGradingFee, recommendationOutcome, talkToPanel } from "./grading.ts";
import { gradingFee } from "./money.ts";
import { exceptionLine } from "./scenes/content.ts";
import { isOpen, lockFor, unmet, LADDER } from "./progress.ts";
import { wrapText } from "./art/font.ts";
import { rankLabel } from "./ranks.ts";
import { createRunState, recordCup, type RunState } from "./run-state.ts";
import { DIALOGUE_LINES, DIALOGUE_WIDTH } from "./scenes/content.ts";
import { askAway, showLetter, verificationOutcome } from "./grading.ts";
import { atLeastDan, hasLetter, personDan } from "./ranks.ts";
import { senpaiMenu, senseiMenu } from "./scenes/club-story.ts";
import { MENU_LETTER } from "./scenes/content.ts";
import { speakerOf } from "./scenes/bubble.ts";

const start = createRunState();
const ready: RunState = { ...start, linePasses: 3, waza: true, beaten: ["raccoon"] };

test("asking too early tells you what you still need, and starts nothing", () => {
  const reply = askToGrade(start, "sensei");
  assert.equal(reply.fight, null);
  assert.match(reply.lines.join(" "), /line drill/);
  assert.match(reply.lines.join(" "), /Sora/);
});

test("once you've done enough, whoever you asked tests you, or sends you to someone who can", () => {
  assert.equal(gradingReady(start), false);
  assert.equal(gradingReady(ready), true);
  assert.equal(askToGrade(ready, "aki").fight, "aki");
  assert.equal(askToGrade(ready, "bo").fight, "bo");
  assert.equal(askToGrade(ready, "sensei").fight, "yui");
});

test("the higher the dan, the more senior the person who has to vouch for you", () => {
  const second: RunState = { ...ready, dan: 1, beaten: ["raccoon", "goose"] };
  assert.equal(askToGrade(second, "aki").fight, null);
  assert.match(askToGrade(second, "aki").lines.join(" "), /Sensei/);
  assert.equal(askToGrade(second, "sensei").fight, "momo");
  const third: RunState = { ...ready, dan: 2, beaten: ["raccoon", "goose", "heron", "otter"] };
  assert.equal(askToGrade(third, "yui").fight, null);
  assert.equal(askToGrade(third, "sensei").fight, "sensei");
});

test("winning that bout earns a ticket, not a rank, and nothing else", () => {
  const won = recommendationOutcome(ready, true);
  assert.equal(won.run.ticket, 1);
  assert.equal(won.run.dan, 0);
  assert.deepEqual(won.run.beaten, ready.beaten);
  assert.equal(hasTicket(won.run), true);
  const lost = recommendationOutcome(ready, false);
  assert.equal(lost.run.ticket, 0);
  assert.ok(lost.lines.length > 0);
});

test("whoever tested you says how it went, so it isn't you saying it", () => {
  for (const won of [true, false]) {
    for (const line of recommendationOutcome(ready, won, undefined, "Yui").lines) assert.equal(speakerOf(line), "Yui");
    const holding = { ...ready, letter: 1, letterFrom: "Rio" };
    for (const line of verificationOutcome(holding, won, "Sensei Kuma").lines) assert.equal(speakerOf(line), "Sensei Kuma");
  }
  assert.equal(speakerOf(recommendationOutcome(ready, true, "Rio", "Rio").lines[0]), "Rio");
});

test("beating Sensei to earn a ticket isn't also an exception", () => {
  const third: RunState = { ...ready, dan: 2, beaten: ["raccoon", "goose", "heron", "otter"] };
  const won = recommendationOutcome(third, true);
  assert.equal(won.run.dan, 2);
  assert.equal(won.run.beaten.includes("sensei"), false);
});

test("nobody sends you twice: with a ticket in hand, they tell you to use it", () => {
  const holding: RunState = { ...ready, ticket: 1 };
  assert.equal(askToGrade(holding, "sensei").fight, null);
  assert.match(askToGrade(holding, "sensei").lines.join(" "), /ticket/i);
  assert.equal(gradingReady(holding), false);
});

test("rising by another route retires the ticket for that rank", () => {
  const holding: RunState = { ...ready, ticket: 1 };
  const cup = recordCup(holding, "raccoon");
  assert.equal(cup.dan, 1);
  assert.equal(hasTicket(cup), false);
  assert.equal(cup.ticket, 0);
});

test("the exam is two parts in order: a demonstration, then a bout", () => {
  const holding: RunState = { ...ready, ticket: 1, money: 500 };
  const first = talkToPanel(holding, null);
  assert.equal(first.next, "kihon");
  assert.equal(first.fight, null);
  const after = kihonOutcome(true);
  assert.equal(after.next, "tachiai");
  const second = talkToPanel(holding, "tachiai");
  assert.equal(second.next, "tachiai");
  assert.equal(second.fight, gradingPartner(1));
  assert.notEqual(gradingPartner(1), gradingPartner(2));
});

test("failing the demonstration ends the attempt, and the ticket's still good", () => {
  const failed = kihonOutcome(false);
  assert.equal(failed.next, null);
  assert.ok(failed.lines.length > 0);
});

test("the panel has nothing for someone without a ticket", () => {
  const reply = talkToPanel(start, null);
  assert.equal(reply.next, null);
  assert.equal(reply.fight, null);
  assert.ok(reply.lines.length > 0);
});

test("passing the bout raises you one dan and uses the ticket; failing keeps it", () => {
  const holding: RunState = { ...ready, ticket: 1 };
  const passed = gradingOutcome(holding, true);
  assert.equal(passed.run.dan, 1);
  assert.equal(passed.run.ticket, 0);
  assert.ok(passed.run.xp > holding.xp);
  assert.match(passed.lines.join(" "), /1st dan/);
  const failed = gradingOutcome(holding, false);
  assert.equal(failed.run.dan, 0);
  assert.equal(hasTicket(failed.run), true);
  assert.ok(failed.lines.length > 0);
});

test("each grading needs the dan before it, and there are three to take", () => {
  const first: RunState = { ...ready, dan: 1 };
  assert.equal(gradingReady(first), false, "2nd dan needs Hana beaten");
  assert.equal(gradingReady({ ...first, beaten: ["raccoon", "goose"] }), true);
  const second: RunState = { ...ready, dan: 2, beaten: ["raccoon", "goose", "heron"] };
  assert.equal(gradingReady(second), false, "3rd dan needs Kenji as well");
  assert.equal(gradingReady({ ...second, beaten: [...second.beaten, "otter"] }), true);
  const top: RunState = { ...second, dan: 3, beaten: [...second.beaten, "otter"] };
  assert.equal(gradingReady(top), false);
  assert.equal(askToGrade(top, "sensei").fight, null);
});

test("a ticket can be used when you're walking around, and not in the middle of something", () => {
  assert.equal(canUseTicketIn("club"), true);
  assert.equal(canUseTicketIn("map"), true);
  assert.equal(canUseTicketIn("rival-dojo"), true);
  assert.equal(canUseTicketIn("duel"), false);
  assert.equal(canUseTicketIn("line"), false);
  assert.equal(canUseTicketIn("tournament"), false);
  assert.equal(canUseTicketIn("grading-hall"), false);
});

test("rank gates opponents and tournaments", () => {
  const atGoose: RunState = { ...start, linePasses: 3, seme: true, bonusKi: 500, beaten: ["raccoon", "aki"] };
  assert.equal(isOpen(atGoose, "goose"), false);
  assert.match(unmet(atGoose, lockFor(atGoose, "goose")!).join(), /1st dan/);
  assert.equal(isOpen({ ...atGoose, dan: 1 }, "goose"), true);
  assert.equal(isOpen(atGoose, "cup:goose"), false);

  const later: RunState = { ...atGoose, dan: 1, beaten: ["raccoon", "goose", "heron", "otter", "aki"] };
  assert.equal(isOpen(later, "heron"), false);
  assert.equal(isOpen(later, "otter"), false);
  assert.equal(isOpen(later, "cup:heron"), false);
  assert.equal(isOpen({ ...later, dan: 2 }, "heron"), true);
  assert.equal(isOpen({ ...later, dan: 2 }, "radish"), false);
  assert.equal(isOpen({ ...later, dan: 3 }, "radish"), true);
});

test("every grading is on the ladder before the fight it opens", () => {
  const at = (id: string) => LADDER.findIndex((row) => row.id === id);
  assert.ok(at("shinsa:1") >= 0 && at("shinsa:1") < at("goose"));
  assert.ok(at("shinsa:2") >= 0 && at("shinsa:2") < at("heron"));
  assert.ok(at("shinsa:3") >= 0 && at("shinsa:3") < at("radish"));
});

test("nothing at home gets you past 1st kyu", () => {
  const home: RunState = { ...start, gear: { tare: true, do: true, men: true, kote: true, shinai: true }, trained: true, senseiRounds: 3, linePasses: 3, beaten: ["aki", "bo", "yui"], momoBeaten: true };
  const cup = recordCup(home, "pinecone");
  assert.equal(cup.dan, 0);
  assert.equal(rankLabel(cup), "1st kyu");
});

test("winning a tournament away from home is a way up, and never takes you down", () => {
  assert.equal(recordCup(start, "raccoon").dan, 1);
  assert.equal(recordCup({ ...start, dan: 1 }, "goose").dan, 2);
  assert.equal(recordCup({ ...start, dan: 2 }, "heron").dan, 3);
  assert.equal(recordCup({ ...start, dan: 2 }, "otter").dan, 3);
  assert.equal(recordCup({ ...start, dan: 3 }, "raccoon").dan, 3);
});

test("the first dan's tournament doesn't ask for a dan", () => {
  const afterSora: RunState = { ...start, beaten: ["raccoon"] };
  assert.equal(isOpen(afterSora, "cup:raccoon"), true);
  assert.equal(isOpen(afterSora, "goose"), false);
  assert.equal(isOpen({ ...recordCup(afterSora, "raccoon"), bonusKi: 500, seme: true }, "goose"), true);
});

test("each dan has all three ways up, and you hear about the other two when you ask", () => {
  const not1 = askToGrade(start, "sensei").lines.join(" ");
  assert.match(not1, /Raccoon Open/);
  assert.match(not1, /Sensei/);
  const not2 = askToGrade({ ...start, dan: 1 }, "sensei").lines.join(" ");
  assert.match(not2, /Goose Open/);
  assert.match(not2, /Tetsu/);
  const not3 = askToGrade({ ...start, dan: 2 }, "sensei").lines.join(" ");
  assert.match(not3, /Otter Open/);
  assert.match(not3, /Shin/);
  for (const dan of [0, 1, 2]) {
    for (const line of askToGrade({ ...start, dan }, "sensei").lines) assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
  }
});

test("every attempt costs a fee, and you can't start one you can't pay for", () => {
  const holding: RunState = { ...ready, ticket: 1, money: 0 };
  const broke = talkToPanel(holding, null);
  assert.equal(broke.next, null);
  assert.match(broke.lines.join(" "), /kensen/);
  const flush: RunState = { ...holding, money: 500 };
  const offer = talkToPanel(flush, null);
  assert.equal(offer.next, "kihon");
  assert.match(offer.lines.join(" "), /kensen/);
  assert.equal(payGradingFee(flush).money, 500 - gradingFee(1));
});

test("the bout that follows a passed demonstration is the same attempt, so it costs nothing more", () => {
  const holding: RunState = { ...ready, ticket: 1, money: 0 };
  assert.equal(talkToPanel(holding, "tachiai").next, "tachiai");
});

test("failing keeps the ticket, whether or not you can afford another go", () => {
  const holding: RunState = { ...ready, ticket: 1, money: 0 };
  assert.equal(hasTicket(gradingOutcome(holding, false).run), true);
});

test("everything said about grading fits in one dialogue box, whatever the numbers", () => {
  const fits = (line: string) => assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
  for (const dan of [0, 1, 2]) {
    const beaten: RunState["beaten"] = ["raccoon", "goose", "heron", "otter"];
    const holding: RunState = { ...ready, dan, beaten, ticket: dan + 1, money: 9999 };
    talkToPanel(holding, null).lines.forEach(fits);
    talkToPanel({ ...holding, money: 49 }, null).lines.forEach(fits);
    talkToPanel(holding, "tachiai").lines.forEach(fits);
    gradingOutcome(holding, true).lines.forEach(fits);
    gradingOutcome(holding, false).lines.forEach(fits);
    askToGrade({ ...holding, ticket: 0 }, "sensei").lines.forEach(fits);
    askToGrade({ ...holding, ticket: 0 }, "aki").lines.forEach(fits);
    askToGrade(holding, "sensei").lines.forEach(fits);
  }
  recommendationOutcome(ready, true).lines.forEach(fits);
  recommendationOutcome(ready, false).lines.forEach(fits);
  recommendationOutcome(ready, true, undefined, "Sensei Kuma").lines.forEach(fits);
  recommendationOutcome(ready, false, undefined, "Sensei Kuma").lines.forEach(fits);
  kihonOutcome(true).lines.forEach(fits);
  kihonOutcome(false).lines.forEach(fits);
  fits(exceptionLine("3rd dan"));
});

const readyFor = (dan: number): RunState => ({ ...createRunState(), trained: true, linePasses: 3, waza: true, dan, beaten: ["aki", "raccoon", "goose", "heron", "otter"], gi: true, metSenpai: true });

test("whoever tests you for a ticket is already at that rank or above", () => {
  for (const dan of [0, 1, 2]) {
    for (const asker of ["sensei", "aki", "bo", "yui"] as const) {
      const { fight } = askToGrade(readyFor(dan), asker);
      if (fight) assert.ok(personDan(fight) >= dan + 1, `${asker} for dan ${dan + 1} sends ${fight}`);
    }
  }
});

test("at another dojo, only someone at the target rank or above will write you a letter", () => {
  const atTwo = readyFor(1);
  assert.equal(askAway(atTwo, "ida").fight, null, "Ida's only 1st dan");
  assert.match(askAway(atTwo, "ida").lines.join(" "), /2nd dan/);
  assert.equal(askAway(atTwo, "kei").fight, "kei", "Kei's 2nd dan");
  assert.equal(askAway(readyFor(2), "kei").fight, null);
  assert.equal(askAway(readyFor(2), "goose").fight, "goose", "Hana's 3rd dan");
});

test("the usual requirements still apply away from home", () => {
  const notReady = { ...createRunState(), trained: true };
  assert.equal(askAway(notReady, "goose").fight, null);
});

test("a win at home gets you a ticket, and a win away only gets you a letter", () => {
  const home = recommendationOutcome(readyFor(0), true);
  assert.equal(hasTicket(home.run), true);
  assert.equal(hasLetter(home.run), false);
  const away = recommendationOutcome(readyFor(0), true, "Rio");
  assert.equal(hasTicket(away.run), false);
  assert.equal(hasLetter(away.run), true);
  assert.equal(away.run.letterFrom, "Rio");
  assert.match(away.lines.join(" "), /^Rio:/);
  assert.equal(hasLetter(recommendationOutcome(readyFor(0), false, "Rio").run), false);
});

test("you can't collect a second letter, or one on top of a ticket", () => {
  const withLetter = recommendationOutcome(readyFor(0), true, "Rio").run;
  assert.equal(askAway(withLetter, "goose").fight, null);
  assert.equal(askAway(recommendationOutcome(readyFor(0), true).run, "goose").fight, null);
});

test("a letter gets you one of three answers at home, and it's down to luck", () => {
  const run = recommendationOutcome(readyFor(0), true, "Rio").run;
  const answers = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99].map((roll) => showLetter(run, "sensei", roll));
  const yes = answers.filter((a) => hasTicket(a.run));
  const tests = answers.filter((a) => a.fight);
  const no = answers.filter((a) => !a.fight && !hasTicket(a.run));
  assert.ok(yes.length && tests.length && no.length, `${yes.length} ${tests.length} ${no.length}`);
  for (const a of yes) assert.equal(hasLetter(a.run), false);
  for (const a of tests) assert.equal(hasLetter(a.run), true, "the letter's still yours while they test you");
  for (const a of no) assert.equal(hasLetter(a.run), false, "a no means the letter's no good");
  for (const a of answers) assert.ok(a.lines.join(" ").includes("Rio"));
});

test("everyone at home has their own way of taking a letter", () => {
  const run = recommendationOutcome(readyFor(0), true, "Rio").run;
  const oddsOf = (asker: "aki" | "yui") => {
    let yes = 0;
    for (let roll = 0; roll < 1; roll += 0.01) if (hasTicket(showLetter(run, asker, roll).run)) yes++;
    return yes;
  };
  assert.ok(oddsOf("aki") > oddsOf("yui"));
});

test("whoever tests a letter is at its rank or above, and senpai only handle 1st dan", () => {
  for (const rank of [1, 2, 3]) {
    const run = { ...readyFor(rank - 1), letter: rank, letterFrom: "Rio" };
    for (let roll = 0; roll < 1; roll += 0.02) {
      const { fight } = showLetter(run, "sensei", roll);
      if (fight) assert.ok(personDan(fight) >= rank, String(fight));
    }
  }
  const second = { ...readyFor(1), letter: 2, letterFrom: "Kei" };
  const bo = showLetter(second, "bo", 0);
  assert.equal(hasTicket(bo.run), false);
  assert.equal(hasLetter(bo.run), true, "Bo sends you to Sensei, and you keep the letter");
});

test("the test is one point: pass and you have a ticket, lose and you keep your letter", () => {
  const run = { ...readyFor(0), letter: 1, letterFrom: "Rio" };
  const won = verificationOutcome(run, true);
  assert.equal(hasTicket(won.run), true);
  assert.equal(hasLetter(won.run), false);
  const lost = verificationOutcome(run, false);
  assert.equal(hasTicket(lost.run), false);
  assert.equal(hasLetter(lost.run), true);
});

test("a rank you've reached some other way makes a letter for it worthless", () => {
  const run = { ...readyFor(0), letter: 1, letterFrom: "Rio" };
  assert.equal(hasLetter(atLeastDan(run, 1)), false);
  assert.equal(askToGrade(atLeastDan(run, 1), "sensei").fight !== undefined, true);
});

test("passing retires the ticket, so the next rank starts with a new bout", () => {
  const passed = gradingOutcome({ ...readyFor(0), ticket: 1 }, true).run;
  assert.equal(passed.dan, 1);
  assert.equal(hasTicket(passed), false);
  assert.ok(askToGrade({ ...passed, beaten: readyFor(0).beaten }, "sensei").fight);
});

test("the menus at home offer your letter when you've got one", () => {
  const run = { ...readyFor(0), letter: 1, letterFrom: "Rio" };
  assert.ok(senseiMenu(run).some((option) => option.label === MENU_LETTER));
  assert.ok(senpaiMenu(run).some((option) => option.label === MENU_LETTER));
  assert.ok(!senseiMenu(readyFor(0)).some((option) => option.label === MENU_LETTER));
});

test("nobody's sent for 1st dan without the waza lesson, and Sensei says what's missing", () => {
  const notYet: RunState = { ...ready, waza: false };
  assert.equal(gradingReady(notYet), false);
  const reply = askToGrade(notYet, "sensei");
  assert.equal(reply.fight, null);
  assert.match(reply.lines.join(" "), /waza/);
  assert.equal(askAway(notYet, "raccoon").fight, null);
});
