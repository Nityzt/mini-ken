import test from "node:test";
import assert from "node:assert/strict";
import type { Game } from "../core/scene.ts";
import { createRunState } from "../run-state.ts";
import { createOnlineScene } from "./online.ts";
import { DEFAULT_APPEARANCE } from "../net/appearance.ts";

function setup(invite: string | null, signedIn = true) {
  let pressed: string[] = [];
  const went: string[] = [];
  let asked = false;
  const account = { status: () => "signed-in", current: () => (signedIn ? { name: "you" } : null) };
  const game = {
    run: createRunState(),
    session: null,
    debug: {},
    go: (scene: string) => went.push(scene),
    input: { wasPressed: (a: string) => pressed.includes(a), isDown: () => false },
    online: {
      invite,
      inviteTutorialTried: false,
      lobbyIntent: null,
      returnTo: "title",
      account,
      service: { live: true },
      access: () => ({ open: true, via: "story" }),
      storySettled: () => true,
      accountUi: () => false,
      profile: () => ({ primer: asked, appearance: DEFAULT_APPEARANCE }),
      primerAsked: () => (asked = true),
    },
  } as unknown as Game;
  const scene = createOnlineScene();
  scene.enter!(game);
  const update = (...keys: string[]) => {
    pressed = keys;
    scene.update(game);
    pressed = [];
  };
  return { game, went, update, account, isAsked: () => asked };
}

test("an invite waits while a new player chooses their appearance", () => {
  const { game, went, update } = setup("ABCDE");
  game.online.profile = () => ({ primer: false } as ReturnType<Game["online"]["profile"]>);
  update();
  assert.deepEqual(went, ["online-appearance"]);
  assert.equal(game.online.invite, "ABCDE");
});

test("an invite waits while the offer's up, and declining goes straight to that lobby", () => {
  const { game, went, update, isAsked } = setup("ABCDE");
  update();
  assert.equal(game.online.invite, "ABCDE");
  assert.deepEqual(went, []);
  update("down");
  update("confirm");
  assert.equal(isAsked(), true);
  assert.deepEqual(game.online.lobbyIntent, { kind: "join", code: "ABCDE" });
  assert.deepEqual(went, ["online-lobby"]);
  assert.equal(game.online.invite, null);
});

test("taking the tutorial keeps the invite for when you're back", () => {
  const { game, went, update } = setup("ABCDE");
  update();
  update("confirm");
  assert.deepEqual(went, ["training"]);
  assert.equal(game.online.invite, "ABCDE");
  assert.equal(game.session?.kind, "quick");
  // Back from the tutorial, there's nothing more to offer, so on to the lobby.
  update();
  assert.deepEqual(game.online.lobbyIntent, { kind: "join", code: "ABCDE" });
  assert.deepEqual(went, ["training", "online-lobby"]);
});

test("signing in behind the offer doesn't replace it", () => {
  const { game, went, update, account } = setup("ABCDE", false);
  update();
  account.current = () => ({ name: "you" });
  update();
  update("down");
  update("confirm");
  assert.deepEqual(game.online.lobbyIntent, { kind: "join", code: "ABCDE" });
  assert.deepEqual(went, ["online-lobby"]);
});

test("backing out of the offer counts as saying no", () => {
  const { game, went, update, isAsked } = setup("ABCDE");
  update();
  update("cancel");
  update();
  assert.equal(isAsked(), true);
  assert.deepEqual(went, ["online-lobby"]);
  assert.deepEqual(game.online.lobbyIntent, { kind: "join", code: "ABCDE" });
});
