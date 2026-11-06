import test from "node:test";
import assert from "node:assert/strict";
import type { Game } from "../core/scene.ts";
import { createTitleScene } from "./title.ts";

function setup(hasSave: boolean) {
  const pressed = new Set<string>();
  const world = { hasSave, went: [] as string[], continued: 0 };
  const game = {
    input: { wasPressed: (action: string) => pressed.has(action) },
    hasSave: () => world.hasSave,
    go: (scene: string) => void world.went.push(scene),
    continueGame: () => void world.continued++,
    online: { returnTo: "title" },
  } as unknown as Game;
  const scene = createTitleScene();
  scene.enter!(game);
  const press = (action: string) => {
    pressed.add(action);
    scene.update(game);
    pressed.clear();
  };
  return { world, press };
}

test("a story arriving from the account after the title's up is offered, and Start can't erase it", () => {
  const { world, press } = setup(false);
  world.hasSave = true;
  press("confirm");
  assert.equal(world.continued, 1);
  assert.deepEqual(world.went, []);
});

test("a story removed elsewhere stops being offered", () => {
  const { world, press } = setup(true);
  world.hasSave = false;
  press("confirm");
  assert.equal(world.continued, 0);
  assert.deepEqual(world.went, ["character"]);
});

test("the erase warning doesn't carry over to a different set of choices", () => {
  const { world, press } = setup(true);
  press("down");
  press("confirm");
  world.hasSave = false;
  press("cancel");
  world.hasSave = true;
  press("confirm");
  assert.deepEqual(world.went, []);
  assert.equal(world.continued, 1);
});
