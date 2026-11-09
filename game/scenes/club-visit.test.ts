import test from "node:test";
import assert from "node:assert/strict";
import type { Game, SceneName } from "../core/scene.ts";
import { createRunState, type RunState } from "../run-state.ts";
import { createClubScene } from "./club.ts";
import { REN_FIRST } from "./content.ts";
import { homeVisitor, renPointOutcome } from "./visits.ts";

const FULL = { tare: true, do: true, men: true, kote: true, shinai: true };
const bogu = (): RunState => ({ ...createRunState(), metSenpai: true, gi: true, senseiRounds: 3, gear: FULL, trained: true, seen: ["ren-tare"] });

/** Just enough of a game to walk the club scene through a visit without a screen. */
function fakeGame(run: RunState) {
  let pressing = false;
  const went: SceneName[] = [];
  const game = {
    run,
    input: { wasPressed: (key: string) => pressing && key === "confirm", isDown: () => false, clear() {} },
    audio: { play() {}, say() {} },
    debug: {},
    reducedMotion: false,
    message: null,
    after: [],
    fromFight: false,
    wokeUp: false,
    versus: null,
    go: (scene: SceneName) => went.push(scene),
    showCards: (then: () => void) => then(),
  } as unknown as Game;
  return { game, went, press: (on: boolean) => { pressing = on; } };
}

const boxOf = (game: Game) => game.debug.visitor as { x: number; y: number } | null;
const spot = (game: Game) => { const box = boxOf(game)!; return { x: box.x, y: box.y }; };

test("Ren's first visit doesn't wave you over: Ren's the one who walked", () => {
  assert.doesNotMatch(REN_FIRST.join(" "), /wave/i);
  assert.match(REN_FIRST[0], /walk/i);
});

test("after Ren's one point, nobody has moved and Ren just carries on talking", () => {
  const { game, went, press } = fakeGame(bogu());
  const scene = createClubScene(() => "you");
  scene.enter!(game);
  // Watch Ren walk over, then read to the end of what they came to say.
  let ticks = 0;
  while (!went.length) {
    press(ticks % 2 === 0);
    scene.update(game);
    assert.ok(++ticks < 5000, "Ren never got to the fight");
  }
  press(false);
  assert.equal(game.versus, "renVisit");
  const before = spot(game);
  const you = { ...(game.debug.walker as { x: number; y: number }) };

  game.run = renPointOutcome(game.run, true);
  game.fromFight = true;
  scene.enter!(game);
  assert.deepEqual(spot(game), before, "Ren should still be where the fight began");
  const walker = game.debug.walker as { x: number; y: number };
  assert.deepEqual([walker.x, walker.y], [you.x, you.y], "and so should you");

  // What's next gets said on the spot, with no walking over first.
  scene.update(game);
  assert.equal(game.debug.talking, true);
  assert.deepEqual(spot(game), before);

  // Once the lesson's over, Ren's gone by the door, from where they were standing.
  ticks = 0;
  while (homeVisitor(game.run) === "ren" || boxOf(game)) {
    press(ticks % 2 === 0);
    scene.update(game);
    assert.ok(++ticks < 5000, "Ren never left");
  }
  assert.equal(game.run.gaze, true);
});

test("backing out of the fight's follow-up leaves Ren standing somewhere, not vanished", () => {
  const { game, went, press } = fakeGame(bogu());
  const scene = createClubScene(() => "you");
  scene.enter!(game);
  let ticks = 0;
  while (!went.length) {
    press(ticks % 2 === 0);
    scene.update(game);
    assert.ok(++ticks < 5000);
  }
  press(false);
  // A forfeit: no result, so nothing new to say. Ren goes back to their spot from where they are.
  const before = spot(game);
  game.fromFight = true;
  scene.enter!(game);
  assert.deepEqual(spot(game), before);
  scene.update(game);
  assert.equal(game.debug.talking, false);
  assert.ok(boxOf(game));
});

test("someone who hasn't arrived yet isn't already standing in the room", () => {
  const { game } = fakeGame(bogu());
  const scene = createClubScene(() => "you");
  game.message = ["Good morning."];
  scene.enter!(game);
  // Nobody's come over yet, so there's nobody to talk to.
  assert.equal(boxOf(game), null);
  assert.equal(homeVisitor(game.run), "ren");
  assert.equal((game.debug as { visitorStanding?: boolean }).visitorStanding, false);
});
