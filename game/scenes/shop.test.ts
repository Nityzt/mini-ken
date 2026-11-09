import test from "node:test";
import assert from "node:assert/strict";
import type { Game } from "../core/scene.ts";
import type { Action } from "../core/input.ts";
import { createRunState } from "../run-state.ts";
import { createShop } from "./shop.ts";

function shopGame() {
  const pressed = new Set<Action>();
  const game = {
    run: { ...createRunState(), money: 1000, owned: ["fineShinai"], gear: { ...createRunState().gear, shinai: true } },
    input: { wasPressed: (action: Action) => pressed.has(action) },
    audio: { play: () => {} },
  } as unknown as Game;
  const shop = createShop();
  shop.open("store");
  return { game, shop, press(...actions: Action[]) { pressed.clear(); actions.forEach((action) => pressed.add(action)); shop.update(game); } };
}

test("the modification flow fits a chosen owned shinai and cancel returns to the shelves", () => {
  const { game, shop, press } = shopGame();
  press("right");
  press("confirm");
  press("confirm");
  assert.ok(Object.keys((game.run as unknown as { mods: object }).mods ?? {}).length > 0, "installs a mod rather than buying a shelf item");
  assert.ok(game.run.money < 1000);
  press("cancel");
  assert.equal(shop.active, true, "back from mod selection to target selection");
  press("left");
  press("cancel");
  assert.equal(shop.active, false);
});

test("modification with no equipment can be left without spending money", () => {
  const { game, shop, press } = shopGame();
  game.run = { ...createRunState(), money: 1000 };
  press("right");
  press("confirm");
  assert.equal(game.run.money, 1000);
  press("cancel");
  assert.equal(shop.active, false);
});

test("every stock selection stays in a five-row shop window", async () => {
  const { shopWindow } = await import("./shop.ts");
  for (const length of [0, 1, 5, 6, 20]) {
    for (let selected = 0; selected < length; selected++) {
      const { start, end } = shopWindow(length, selected);
      assert.ok(start <= selected && selected < end);
      assert.ok(end - start <= 5);
      assert.ok(start >= 0 && end <= length);
    }
  }
});
