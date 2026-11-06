import test from "node:test";
import assert from "node:assert/strict";
import type { Game } from "../core/scene.ts";
import { createTitleScene } from "./title.ts";

function setup(hasSave: boolean, state: "none" | "checking" | "guest" | "signed-in" = "none") {
  const pressed = new Set<string>();
  const world = { hasSave, state, went: [] as string[], continued: 0, warned: 0, forms: 0, signOuts: 0, proceed: null as (() => void) | null, returnTo: "story" };
  const game = {
    input: { wasPressed: (action: string) => pressed.has(action) },
    hasSave: () => world.hasSave,
    go: (scene: string) => void world.went.push(scene),
    continueGame: () => void world.continued++,
    online: {
      get returnTo() {
        return world.returnTo;
      },
      set returnTo(value: string) {
        world.returnTo = value;
      },
      accountState: () => world.state,
      account: { current: () => ({ username: "Emi" }) },
      warnGuest(proceed: () => void) {
        world.warned++;
        world.proceed = proceed;
      },
      openAccountForm: () => void world.forms++,
      signOut: () => void world.signOuts++,
    },
  } as unknown as Game;
  const scene = createTitleScene();
  scene.enter!(game);
  const press = (action: string) => {
    pressed.add(action);
    scene.update(game);
    pressed.clear();
  };
  const idle = (ticks: number) => {
    for (let i = 0; i < ticks; i++) scene.update(game);
  };
  return { world, press, idle };
}

test("signed out, signing in comes first", () => {
  const { world, press } = setup(false, "guest");
  press("confirm");
  assert.equal(world.forms, 1);
  assert.deepEqual(world.went, []);
});

test("starting a story as a guest warns first, and only goes on if they accept", () => {
  const { world, press } = setup(false, "guest");
  press("down");
  press("confirm");
  assert.equal(world.warned, 1);
  assert.deepEqual(world.went, []);
  world.proceed!();
  assert.deepEqual(world.went, ["character"]);
});

test("continuing a story as a guest warns too", () => {
  const { world, press } = setup(true, "guest");
  press("down");
  press("confirm");
  assert.equal(world.warned, 1);
  assert.equal(world.continued, 0);
  world.proceed!();
  assert.equal(world.continued, 1);
});

test("a guest's new game is warned about before the erase question", () => {
  const { world, press } = setup(true, "guest");
  press("down");
  press("down");
  press("confirm");
  assert.equal(world.warned, 1);
  world.proceed!();
  assert.deepEqual(world.went, []);
  press("confirm");
  assert.deepEqual(world.went, ["character"]);
});

test("a guest can go to multiplayer with no story warning", () => {
  const { world, press } = setup(false, "guest");
  press("down");
  press("down");
  press("confirm");
  assert.equal(world.warned, 0);
  assert.deepEqual(world.went, ["online"]);
  assert.equal(world.returnTo, "title");
});

test("signed in, a story starts with no warning, and signing out is on offer", () => {
  const { world, press } = setup(false, "signed-in");
  press("confirm");
  assert.equal(world.warned, 0);
  assert.deepEqual(world.went, ["character"]);
  const out = setup(true, "signed-in");
  out.press("up");
  out.press("confirm");
  assert.equal(out.world.signOuts, 1);
});

test("signing in rebuilds the menu, so the old choice can't pick something else", () => {
  const { world, press, idle } = setup(false, "guest");
  press("down");
  world.state = "signed-in";
  idle(1);
  press("confirm");
  assert.deepEqual(world.went, ["character"]);
  assert.equal(world.warned, 0);
});

test("nothing can be picked while finding out who you are, and it doesn't wait forever", () => {
  const { world, press, idle } = setup(false, "checking");
  press("confirm");
  assert.deepEqual(world.went, []);
  assert.equal(world.forms, 0);
  idle(200);
  press("confirm");
  assert.equal(world.forms, 1);
});

test("without a server, it's the plain menu with no warning", () => {
  const { world, press } = setup(false, "none");
  press("confirm");
  assert.equal(world.warned, 0);
  assert.deepEqual(world.went, ["character"]);
});

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
