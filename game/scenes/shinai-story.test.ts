import test from "node:test";
import assert from "node:assert/strict";
import { durabilityOf, FULL_DURABILITY, OLD_SHINAI_DURABILITY } from "../durability.ts";
import { inventoryOf } from "../equipment-screen.ts";
import { asShinai, isWorn, itemsGained, toggleWorn } from "../items.ts";
import { currentObjective } from "../objective.ts";
import { createRunState, type RunState } from "../run-state.ts";
import { answerOffer, answerWhy, talkToMomo, talkToSensei } from "./club-story.ts";
import { fixGear } from "../durability.ts";
import { GEN_BAMBOO, returnLines, SENSEI_MINE_STILL_CRACKED, SENSEI_OFFER, SENSEI_STILL_WAITING, SENSEI_WANTS_IT_BACK, SENSEI_WHY, SHINAI_STEPS, WHY_OPTIONS, WHY_REPLY } from "./content.ts";
import { finishBuilding, fumiNotices, genOnBamboo, shinaiObjective, shopArrival, stepIsRight } from "./shinai-story.ts";

const inGi = (): RunState => ({ ...createRunState(), metSenpai: true, gi: true });
const dan = (): RunState => ({ ...inGi(), senseiRounds: 3, trained: true, dan: 1, whyKendo: "hit", gear: { tare: true, do: true, men: true, kote: true, shinai: true } });

test("Sensei asks why you've come, and every answer gets its own reply", () => {
  const first = talkToSensei(inGi());
  assert.deepEqual(first.lines, SENSEI_WHY);
  assert.equal(first.ask, "why");
  assert.equal(first.run.gear.shinai, false);
  assert.equal(first.session, null);
  assert.ok(WHY_OPTIONS.length >= 3);
  for (const { id } of WHY_OPTIONS) {
    const reply = answerWhy(inGi(), id);
    assert.equal(reply.lines[0], WHY_REPLY[id]);
    assert.deepEqual(reply.lines.slice(1), SENSEI_OFFER, "and goes straight on to the shinai");
    assert.equal(reply.run.whyKendo, id);
    assert.ok(returnLines(id)[0] !== returnLines("")[0], "Sensei remembers it at the end");
  }
});

test("you can turn the offer down, and it's still there", () => {
  const asked = answerWhy(inGi(), "fun").run;
  const no = answerOffer(asked, "no");
  assert.equal(no.run.gear.shinai, false);
  assert.equal(no.session, null);
  assert.equal(talkToSensei(no.run).ask, "offer", "no need to say why twice");
  const yes = answerOffer(asked, "yes");
  assert.equal(yes.run.gear.shinai, true);
  assert.deepEqual(yes.session, { kind: "sensei", round: 0 });
  assert.equal(durabilityOf(yes.run, "shinai"), OLD_SHINAI_DURABILITY);
  assert.ok(OLD_SHINAI_DURABILITY === FULL_DURABILITY / 2, "about half gone");
});

test("the objective and Momo don't mention any chores", () => {
  assert.equal(currentObjective(inGi()), "Greet Sensei Kuma");
  assert.ok(!talkToMomo(inGi()).lines.join(" ").includes("rag"));
});

test("Sensei wants it back once you hold a dan, and not before", () => {
  assert.ok(talkToSensei({ ...dan(), dan: 0 }).menu);
  const reply = talkToSensei(dan());
  assert.deepEqual(reply.lines, SENSEI_WANTS_IT_BACK);
  assert.equal(reply.run.shinaiQuest, "asked");
  assert.ok(!reply.menu);
  const next = talkToSensei(reply.run);
  assert.ok(next.menu, "and after that it's back to business");
  assert.equal(next.lines[0], SENSEI_STILL_WAITING, "with a reminder");
});

const told = (): RunState => {
  const asked = talkToSensei(dan()).run;
  assert.equal(shinaiObjective(asked), "Ask at the Bogu Shop about a shinai");
  const arrival = shopArrival(asked)!;
  assert.equal(arrival.build, false);
  return arrival.run;
};

test("making your own takes the bamboo and Fumi's questions, and puts it in your hand", () => {
  const start = told();
  assert.equal(shopArrival(start)!.build, false, "no bamboo, nothing to build");
  const bamboo = genOnBamboo(start)!;
  assert.deepEqual(bamboo.lines, GEN_BAMBOO);
  assert.deepEqual(itemsGained(start, bamboo.run), ["bamboo"]);
  assert.ok(inventoryOf(bamboo.run).includes("bamboo"));
  assert.equal(genOnBamboo(bamboo.run), null, "once is enough");
  assert.equal(shopArrival(bamboo.run)!.build, true);
  SHINAI_STEPS.forEach((step, i) => {
    assert.ok(step.options.some((option) => option.id === step.right));
    for (const option of step.options) assert.equal(stepIsRight(i, option.id), option.id === step.right);
  });
  const made = finishBuilding(bamboo.run);
  assert.deepEqual(itemsGained(bamboo.run, made), ["ownShinai"]);
  assert.ok(!inventoryOf(made).includes("bamboo"), "the bamboo's in the shinai now");
  assert.equal(shopArrival(made), null);
  assert.ok(isWorn(made, "ownShinai"));
  assert.ok(!isWorn(made, "shinai"));
});

const made = (): RunState => finishBuilding(genOnBamboo(told())!.run);

test("Sensei's shinai only goes back once it's fixed, even with your own in your hand", () => {
  const unfixed = made();
  assert.equal(shinaiObjective(unfixed), "Fix Sensei's shinai at Fumi's bench");
  const refused = talkToSensei(unfixed);
  assert.ok(refused.menu, "nothing changes hands");
  assert.equal(refused.run.shinaiQuest, unfixed.shinaiQuest);
  assert.equal(refused.lines[0], SENSEI_MINE_STILL_CRACKED);
  assert.ok(inventoryOf(unfixed).includes("shinai"));

  const fixed = fixGear(unfixed, "shinai");
  assert.equal(durabilityOf(fixed, "shinai"), FULL_DURABILITY);
  assert.equal(fixed.money, unfixed.money, "your own hands cost nothing");
  assert.equal(shinaiObjective(fixed), "Return Sensei's old shinai");

  const back = talkToSensei(fixed);
  assert.deepEqual(back.lines, returnLines("hit"));
  assert.equal(back.run.shinaiQuest, "returned");
  assert.equal(back.run.bonusKi, fixed.bonusKi + 10);
  assert.equal(back.run.money, fixed.money + 100);
  assert.deepEqual(itemsGained(fixed, back.run), ["shinaiBag"]);
  const held = inventoryOf(back.run);
  assert.ok(held.includes("ownShinai"));
  assert.ok(held.includes("shinaiBag"));
  assert.ok(!held.includes("shinai"), "it went back");
  assert.equal(shinaiObjective(back.run), null);

  const after = talkToSensei(back.run);
  assert.ok(after.menu, "only once");
  assert.equal(after.lines.length, 1, "and no more reminders");
  assert.equal(after.run.bonusKi, back.run.bonusKi);
});

test("buying a shinai gets you something to swing, but it doesn't settle the debt", () => {
  const bought: RunState = { ...told(), owned: ["fineShinai"] };
  assert.ok(isWorn(bought, "shop:fineShinai"), "it's better than the old one, so it's what you carry");
  assert.equal(shopArrival(bought)!.build, false, "Fumi's still got something to teach you");
  assert.ok(genOnBamboo(bought), "and Gen's still got bamboo");
  assert.equal(talkToSensei(bought).run.shinaiQuest, bought.shinaiQuest, "and Sensei's still waiting");
  assert.equal(fixGear(bought, "shinai"), bought, "you can't fix what you never learned to");

  const early: RunState = { ...dan(), owned: ["fineShinai"] };
  assert.deepEqual(talkToSensei(early).lines, SENSEI_WANTS_IT_BACK);
});

test("you pick which shinai you carry from the inventory, and only ever swap", () => {
  const both: RunState = { ...made(), owned: ["fineShinai"] };
  const picked = toggleWorn(both, "shop:fineShinai");
  assert.ok(isWorn(picked, "shop:fineShinai"));
  assert.ok(isWorn(toggleWorn(picked, "shop:fineShinai"), "shop:fineShinai"), "you can't put it down and carry nothing");
  assert.ok(isWorn(toggleWorn(picked, "shinai"), "shinai"));
  assert.equal(asShinai("do"), null);
  assert.equal(toggleWorn(dan(), "ownShinai").wielded, "", "not one you haven't got");
});

test("Fumi notices Sensei's shinai going home, then what you're wearing, once each and only if it's true (owner, 2026-11-11)", () => {
  const made = finishBuilding(dan());
  // Nothing to notice yet, and nothing before the shinai's been made.
  assert.equal(fumiNotices(made), null);
  assert.equal(fumiNotices({ ...dan(), shinaiQuest: "returned", equipped: { kote: "deerKote" } }), null);
  const home = fumiNotices({ ...made, shinaiQuest: "returned" });
  assert.match(home!.lines[0], /back on the rack/);
  assert.equal(fumiNotices(home!.run), null);
  // Owning something isn't wearing it.
  assert.equal(fumiNotices({ ...made, owned: ["deerKote", "forgeDo"] }), null);
  const mine = fumiNotices({ ...made, equipped: { kote: "deerKote" } });
  assert.match(mine!.lines[0], /deerskin kote\. One of mine/);
  const theirs = fumiNotices({ ...mine!.run, equipped: { kote: "deerKote", do: "forgeDo" } });
  assert.match(theirs!.lines[0], /forge do\? Not one of mine/);
  assert.equal(fumiNotices({ ...theirs!.run, equipped: { do: "mistMen" } }), null);
});

test("nobody holding a shinai from an older save has to answer anything", () => {
  const older = { ...inGi(), gear: { ...inGi().gear, shinai: true } };
  assert.equal(talkToSensei(older).ask, undefined);
  assert.deepEqual(talkToSensei(older).session, { kind: "sensei", round: 0 });
});
