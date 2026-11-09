import test from "node:test";
import assert from "node:assert/strict";
import { measureText } from "./art/font.ts";
import { STAGE_W } from "./core/scale.ts";
import { betStakes, CHALLENGES, earn, findEgg, gradingFee, isClaimed, MONEY_NAME, payBet, placeBet, settleChallenges, withFeat } from "./money.ts";
import { personDan } from "./ranks.ts";
import { createRunState, playerKiMax, recordCup, recordGangWin, recordLinePass, recordTower, recordWin, type RunState } from "./run-state.ts";
import { finishSession, lineOutcome } from "./scenes/club-story.ts";
import { fitTitle, statusWidth } from "./scenes/ui.ts";
import { buy, canBuy, LOOKS, SHOP_ITEMS, STALLS, wear, type ShopItemId } from "./shop.ts";
import { maybeTip } from "./money.ts";

const start = createRunState();

test("the money has a name of its own, and you start with none", () => {
  assert.equal(MONEY_NAME, "kensen");
  assert.equal(start.money, 0);
  assert.equal(earn(start, 25).money, 25);
});

test("helping people on the street pays", () => {
  assert.ok(recordGangWin(start, "market").money > 0);
});

test("helping with training pays, and so do the drills", () => {
  assert.ok(recordLinePass(start).money > 0);
  assert.ok(finishSession(start, { kind: "sensei", round: 1 }).run.money > 0);
  const helped = lineOutcome(start, { passed: true, cleans: 4, count: 4 }, true);
  assert.ok(helped.run.money > 0);
  assert.equal(helped.run.linePasses, 0, "helping out isn't your own practice");
  assert.equal(lineOutcome(start, { passed: false, cleans: 1, count: 4 }, true).run.money, 0);
});

test("wins pay well the first time, and a little after", () => {
  const first = recordWin({ ...start, node: "raccoon" });
  const again = recordWin(first);
  assert.ok(first.money > again.money - first.money);
  assert.ok(again.money > first.money);
  assert.ok(recordCup(start, "raccoon").money > 0);
  assert.ok(recordTower(start).money > 0);
});

test("challenges pay once each, whenever they're done", () => {
  const run: RunState = { ...start, beaten: ["aki", "bo", "yui"] };
  const done = CHALLENGES.find((c) => c.id === "senpai")!;
  assert.equal(done.done(run), true);
  const settled = settleChallenges(run);
  assert.equal(settled.money, done.reward);
  assert.equal(settleChallenges(settled), settled, "it doesn't pay twice");
  assert.equal(settleChallenges(start), start, "and nothing changes if nothing's done");
});

test("a flawless win and a perfect line are challenges too", () => {
  const flawless = withFeat(start, "flawless");
  assert.equal(CHALLENGES.find((c) => c.id === "flawless")!.done(flawless), true);
  assert.equal(CHALLENGES.find((c) => c.id === "flawless")!.done(start), false);
  const perfect = lineOutcome(start, { passed: true, cleans: 5, count: 5 }).run;
  assert.equal(CHALLENGES.find((c) => c.id === "perfectLine")!.done(perfect), true);
  assert.equal(CHALLENGES.find((c) => c.id === "perfectLine")!.done(lineOutcome(start, { passed: true, cleans: 4, count: 5 }).run), false);
});

test("every challenge fits on the page", () => {
  for (const c of CHALLENGES) assert.ok(measureText(`${c.label} ${c.reward}`) <= STAGE_W - 30, c.label);
});

test("easter eggs pay once, and only where they're hidden", () => {
  assert.equal(findEgg(start, "pinecone", "M"), null);
  assert.equal(findEgg(start, "heron", "p"), null);
  const found = findEgg(start, "goose", "p")!;
  assert.ok(found.run.money > 0);
  assert.ok(found.lines.length > 0);
  assert.equal(findEgg(found.run, "goose", "p"), null);
  assert.ok(findEgg(start, "pinecone", "r"));
  assert.ok(findEgg(start, "radish", "r"));
  assert.ok(findEgg(start, "raccoon", "p"));
});

test("you can only bet what you have, and what your opponent will accept", () => {
  assert.deepEqual(betStakes({ ...start, money: 0 }, "aki"), []);
  assert.deepEqual(betStakes({ ...start, money: 30 }, "aki"), [10, 25]);
  assert.ok(Math.max(...betStakes({ ...start, money: 9999 }, "aki")) < Math.max(...betStakes({ ...start, money: 9999 }, "radish")));
  assert.deepEqual(betStakes({ ...start, money: 9999 }, "renVisit"), []);
  assert.deepEqual(betStakes({ ...start, money: 9999 }, "momo"), []);
  assert.ok(personDan("radish") > personDan("aki"));
});

test("a bet is paid up front, and a win pays it back double", () => {
  const placed = placeBet({ ...start, money: 100 }, 25);
  assert.equal(placed.money, 75);
  assert.equal(payBet(placed, 25, true).money, 125);
  assert.equal(payBet(placed, 25, false).money, 75);
  assert.equal(placeBet({ ...start, money: 10 }, 25).money, 10, "you can't bet what you haven't got");
});

test("the fee goes up with the rank", () => {
  assert.ok(gradingFee(1) > 0);
  assert.ok(gradingFee(2) > gradingFee(1));
  assert.ok(gradingFee(3) > gradingFee(2));
});

test("every stall has stock, everything's priced, and every item is sold somewhere", () => {
  const sold = new Set(Object.values(STALLS).flat());
  for (const id of Object.keys(SHOP_ITEMS) as ShopItemId[]) {
    assert.ok(sold.has(id), id);
    assert.ok(SHOP_ITEMS[id].price > 0, id);
  }
  for (const stall of ["store", "cup", "pinecone", "raccoon", "goose", "heron", "otter", "radish"] as const) assert.ok(STALLS[stall].length > 0, stall);
});

test("buying takes the money, once, and only if you have it", () => {
  const id = STALLS.store[0];
  const price = SHOP_ITEMS[id].price;
  assert.equal(canBuy({ ...start, money: price - 1 }, id), false);
  assert.equal(buy({ ...start, money: price - 1 }, id).money, price - 1);
  const bought = buy({ ...start, money: price + 5 }, id);
  assert.equal(bought.money, 5);
  assert.ok(bought.owned.includes(id));
  assert.equal(canBuy({ ...bought, money: 9999 }, id), false);
  assert.equal(buy({ ...bought, money: 9999 }, id).money, 9999);
});

test("some gear makes you stronger", () => {
  const gear = (Object.keys(SHOP_ITEMS) as ShopItemId[]).find((id) => SHOP_ITEMS[id].ki)!;
  const run = { ...start, money: 9999 };
  assert.equal(playerKiMax(buy(run, gear)) - playerKiMax(run), SHOP_ITEMS[gear].ki);
});

test("colors change how you look and nothing else, and you can only wear what you own", () => {
  const look = (Object.keys(SHOP_ITEMS) as ShopItemId[]).find((id) => LOOKS[id])!;
  assert.equal(wear(start, look).look, "");
  const bought = buy({ ...start, money: 9999 }, look);
  assert.equal(bought.look, look, "new colors go on straight away");
  assert.equal(playerKiMax(bought), playerKiMax(start));
  assert.equal(wear(bought, look).look, "", "wearing them again takes them off");
});


test("the status bar never runs into a place's name: long ones lose the word Dojo", () => {
  const worst = statusWidth({ ...start, trained: true, dan: 3, xp: 40000, bonusKi: 400, money: 99999 });
  const title = fitTitle("Thunder Radish Dojo", STAGE_W, worst);
  assert.equal(title, "Thunder Radish");
  assert.ok(measureText(title) + worst + 6 <= STAGE_W, `${measureText(title)} + ${worst}`);
  assert.equal(fitTitle("Thunder Radish Dojo", 400, worst), "Thunder Radish Dojo", "on a wide window it fits");
  assert.equal(fitTitle("Pinecone Dojo", STAGE_W, statusWidth(start)), "Pinecone Dojo");
});

test("nobody's asked to pay for what they're already wearing: the home table sells your own colors", () => {
  assert.deepEqual(STALLS.pinecone.filter((id) => !!LOOKS[id]), ["ownColors"]);
  const bought = buy({ ...start, money: 9999 }, "ownColors");
  assert.equal(bought.look, "ownColors");
  assert.equal(wear(bought, "ownColors").look, "", "taking them off puts you back in the dojo's");
});

test("every other dojo sells its own colors", () => {
  for (const id of ["raccoon", "goose", "heron", "otter", "radish"] as const) assert.deepEqual(STALLS[id].filter((item) => !!LOOKS[item]), [`${id}Colors`]);
});

test("now and then someone tips you, and it's never a fortune", () => {
  let tipped = 0;
  for (let roll = 0; roll < 1; roll += 0.01) {
    const { run, line } = maybeTip(start, roll);
    if (line) {
      tipped++;
      assert.ok(run.money > start.money && run.money <= start.money + 25, String(roll));
      assert.ok(line.includes(String(run.money - start.money)), line);
    } else assert.equal(run, start);
  }
  assert.ok(tipped > 10 && tipped < 45, String(tipped));
});

test("helping the beginners sometimes earns a tip on top", () => {
  const passed = { passed: true, cleans: 3, count: 3 };
  assert.ok(lineOutcome(start, passed, true, 0).run.money > lineOutcome(start, passed, true, 0.99).run.money);
  assert.ok(lineOutcome(start, passed, true, 0).lines.length > lineOutcome(start, passed, true, 0.99).lines.length);
});

test("there's a challenge for beating every dojo's sensei", () => {
  const all = { ...start, beaten: ["nemu", "kan", "mizu", "hagane", "raiko"] as RunState["beaten"] };
  assert.ok(isClaimed(settleChallenges(all), "senseis"));
  assert.ok(!isClaimed(settleChallenges({ ...start, beaten: ["nemu"] as RunState["beaten"] }), "senseis"));
});
