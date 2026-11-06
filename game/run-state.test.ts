import test from "node:test";
import assert from "node:assert/strict";
import { createRunState, duelOptionsFor, lossesHere, playerKiMax, type RunState, recordCup, recordGangWin, recordLinePass, recordLoss, recordTower, recordWin, rivalConfigFor } from "./run-state.ts";
import { createDuel } from "./duel/rules.ts";

test("a new run has no gear, no training and no tsuba", () => {
  const r = createRunState();
  assert.equal(Object.values(r.gear).some(Boolean), false);
  assert.equal(r.metSenpai, false);
  assert.equal(r.gi, false);
  assert.equal(r.trained, false);
  assert.equal(r.hasTsuba, false);
  assert.equal(lossesHere(r), 0);
});

test("rematch state does not leak", () => {
  let r = createRunState();
  r = { ...r, hasTsuba: true };
  for (let i = 0; i < 20; i++) r = recordLoss(r);
  const d = createDuel(duelOptionsFor(r));
  assert.deepEqual(d.fighters.map((f) => f.points), [0, 0]);
  assert.equal(d.fighters[0].ki, playerKiMax(r));
  assert.equal(d.fighters[0].kiMax, playerKiMax(r));
  assert.equal(rivalConfigFor(r).tell.men, 46);
});

test("a win resets losses and keeps the tsuba and gear", () => {
  let r = createRunState();
  r = { ...r, hasTsuba: true, gear: { ...r.gear, men: true } };
  r = recordWin(recordLoss(r));
  assert.equal(lossesHere(r), 0);
  assert.equal(r.hasTsuba, true);
  assert.equal(r.gear.men, true);
});

test("without the tsuba the player has normal ki", () => {
  assert.equal(createDuel(duelOptionsFor(createRunState())).fighters[0].kiMax, 100);
});

test("duel options give the rival its tell lengths for this many losses", () => {
  const options = duelOptionsFor(recordLoss(createRunState()));
  assert.equal(options.windups?.[1].men, 34);
  assert.equal(options.windups?.[1].kote, 34);
  assert.equal(options.windups?.[1].bigMen, 50);
  assert.deepEqual(options.windups?.[0], {});
});

test("a new run hasn't learned seme or met Momo in a fight", () => {
  const r = createRunState();
  assert.equal(r.seme, false);
  assert.equal(r.momoBeaten, false);
  assert.equal(r.senseiRounds, 0);
});

test("a new run starts at the home dojo with nothing cleared", () => {
  const r = createRunState();
  assert.equal(r.node, "pinecone");
  assert.deepEqual(r.cleared, []);
  assert.equal(r.bonusKi, 0);
});

test("beating a gang clears it and grows the player's ki", () => {
  const r = recordGangWin(createRunState(), "market");
  assert.deepEqual(r.cleared, ["market"]);
  assert.equal(createDuel(duelOptionsFor(r)).fighters[0].kiMax, 110);
});

test("a gang can only pay out once", () => {
  const r = recordGangWin(recordGangWin(createRunState(), "market"), "market");
  assert.deepEqual(r.cleared, ["market"]);
  assert.equal(r.bonusKi, 10);
});

test("the view from the tower only pays out once", () => {
  const r = recordTower(recordTower(createRunState()));
  assert.equal(r.bonusKi, 10);
  assert.equal(r.blessed, true);
});

test("the tsuba and the road's rewards add up", () => {
  const r = recordTower(recordGangWin({ ...createRunState(), hasTsuba: true }, "bridge"));
  assert.equal(createDuel(duelOptionsFor(r)).fighters[0].kiMax, 145);
});

test("losing to one rival doesn't make another one easier", () => {
  let r: RunState = { ...createRunState(), node: "radish" };
  r = recordLoss(recordLoss(r));
  assert.equal(lossesHere(r), 2);
  const atGoose = { ...r, node: "goose" as const };
  assert.equal(lossesHere(atGoose), 0);
  assert.equal(rivalConfigFor(atGoose).tell.men, rivalConfigFor({ ...createRunState(), node: "goose" }).tell.men);
});

test("beating one rival keeps your losing streak against the other", () => {
  let r: RunState = recordLoss({ ...createRunState(), node: "radish" });
  r = recordWin({ ...r, node: "goose" as const });
  assert.equal(lossesHere({ ...r, node: "radish" }), 1);
});

test("the duel uses the tells of the rival you're facing", () => {
  const atRadish = { ...createRunState(), node: "radish" as const };
  const atGoose = { ...createRunState(), node: "goose" as const };
  assert.deepEqual(duelOptionsFor(atRadish).windups?.[1], rivalConfigFor(atRadish).tell);
  assert.deepEqual(duelOptionsFor(atGoose).windups?.[1], rivalConfigFor(atGoose).tell);
});

test("passing the line drill counts up and grows ki, but only the first few times", () => {
  let r = createRunState();
  r = recordLinePass(r);
  assert.equal(r.linePasses, 1);
  assert.equal(r.bonusKi, 5);
  r = recordLinePass(recordLinePass(r));
  assert.equal(r.bonusKi, 15);
  r = recordLinePass(r);
  assert.equal(r.linePasses, 4);
  assert.equal(r.bonusKi, 15);
});

test("the first win over someone grows ki, and rematches don't", () => {
  let r = recordWin(createRunState(), "aki");
  assert.deepEqual(r.beaten, ["aki"]);
  assert.equal(r.bonusKi, 5);
  r = recordWin(r, "aki");
  assert.equal(r.bonusKi, 5);
  r = recordWin(r, "bo");
  assert.equal(r.bonusKi, 10);
  r = recordWin({ ...r, node: "radish" });
  assert.deepEqual(r.beaten, ["aki", "bo", "radish"]);
  assert.equal(r.bonusKi, 20);
});

test("beating Momo pays out through the tsuba, not through extra ki", () => {
  assert.equal(recordWin(createRunState()).bonusKi, 0);
});

test("losses are kept per senpai when sparring", () => {
  const r = recordLoss(recordLoss(createRunState(), "aki"), "aki");
  assert.equal(lossesHere(r, "aki"), 2);
  assert.equal(lossesHere(r, "bo"), 0);
  assert.equal(lossesHere(r), 0, "Momo's count is separate");
  assert.equal(lossesHere(recordWin(r, "aki"), "aki"), 0);
});

test("a senpai spar is a fair fight at home, with none of Momo's advantages", () => {
  const options = duelOptionsFor(createRunState(), "bo");
  assert.equal(options.presence, undefined);
  assert.deepEqual(options.kiMax, [100, 100]);
  assert.deepEqual(options.windups?.[1], rivalConfigFor(createRunState(), "bo").tell);
});

test("each rival fights with their own ki", () => {
  assert.equal(duelOptionsFor({ ...createRunState(), node: "radish" }).kiMax?.[1], 150);
  assert.equal(duelOptionsFor({ ...createRunState(), node: "goose" }).kiMax?.[1], 100);
});

test("Ren alone among the rivals has an aura, and it's far weaker than Momo's", () => {
  const presence = (node: "radish" | "goose" | "raccoon" | "heron" | "otter" | "pinecone") => duelOptionsFor({ ...createRunState(), node }).presence?.[1] ?? 0;
  for (const node of ["goose", "raccoon", "heron", "otter"] as const) assert.equal(presence(node), 0, node);
  assert.ok(presence("radish") > 0);
  assert.ok(presence("radish") < presence("pinecone"));
});

test("a tournament match ignores your losing streak", () => {
  let r: RunState = { ...createRunState(), node: "goose" };
  r = recordLoss(recordLoss(r), "radish");
  assert.notDeepEqual(rivalConfigFor(r, "radish").tell, rivalConfigFor(r, "radish", true).tell);
  assert.deepEqual(rivalConfigFor(r, "radish", true).tell, rivalConfigFor(createRunState(), "radish").tell);
  assert.deepEqual(duelOptionsFor(r, "radish", true).windups?.[1], rivalConfigFor(createRunState(), "radish").tell);
});

test("winning the tournament pays out once", () => {
  const first = recordCup(createRunState(), "grand");
  assert.equal(first.champion, true);
  assert.equal(first.bonusKi, 20);
  assert.equal(recordCup(first, "grand").bonusKi, 20);
});

test("a dojo's cup pays out once, and it's enough to matter", () => {
  const first = recordCup(createRunState(), "raccoon");
  assert.equal(first.bonusKi, 15);
  assert.deepEqual(first.cups, ["raccoon"]);
  assert.equal(recordCup(first, "raccoon").bonusKi, 15);
  assert.equal(first.champion, false);
});

test("winning the Grand Taikai makes you champion", () => {
  const run = recordCup(createRunState(), "grand");
  assert.equal(run.champion, true);
  assert.deepEqual(run.cups, ["grand"]);
});

test("everyone starts as the first character with a plain tare", () => {
  const run = createRunState();
  assert.equal(run.character, "haru");
  assert.equal(run.insignia.symbol, "plain");
});
