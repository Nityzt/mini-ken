import test from "node:test";
import assert from "node:assert/strict";
import type { Game } from "../core/scene.ts";
import { createRunState, type RunState } from "../run-state.ts";
import { createClubScene } from "./club.ts";

const FULL = { tare: true, do: true, men: true, kote: true, shinai: true };
/** Trained, with nobody dropping by, so the room is just you and the usual faces. */
const settled = (): RunState => ({ ...createRunState(), metSenpai: true, gi: true, senseiRounds: 3, gear: FULL, trained: true, gaze: true, beaten: ["radish"] });

/** Just enough of a game to walk around the club without a screen. */
function fakeGame(run: RunState) {
  const held = new Set<string>();
  let confirming = false;
  const game = {
    run,
    input: { wasPressed: (key: string) => confirming && key === "confirm", isDown: (key: string) => held.has(key), clear() {} },
    audio: { play() {}, say() {} },
    debug: {},
    reducedMotion: false,
    message: null,
    after: [],
    returning: false,
    wokeUp: false,
    versus: null,
    go() {},
    showCards: (then: () => void) => then(),
  } as unknown as Game;
  return { game, held, confirm: (on: boolean) => { confirming = on; } };
}

const where = (game: Game) => {
  const box = game.debug.walker as { x: number; y: number };
  return { x: box.x, y: box.y, facing: game.debug.facing };
};

/** Lets the walk in through the door and any welcome play out, then walks left for a while. */
function standSomewhere(scene: ReturnType<typeof createClubScene>, game: Game, held: Set<string>, confirm: (on: boolean) => void) {
  scene.enter!(game);
  for (let i = 0; i < 600; i++) {
    confirm(i % 2 === 0);
    scene.update(game);
  }
  confirm(false);
  const start = where(game);
  held.add("left");
  for (let i = 0; i < 20; i++) scene.update(game);
  held.clear();
  scene.update(game);
  const spot = where(game);
  assert.notDeepEqual([spot.x, spot.y], [start.x, start.y], "the walk should have gone somewhere");
  return spot;
}

for (const message of [null, ["Sensei: Good."]]) {
  test(`back from a drill ${message ? "with something to say" : "in silence"}, you're standing and facing where you were`, () => {
    const { game, held, confirm } = fakeGame(settled());
    const scene = createClubScene(() => "you");
    const spot = standSomewhere(scene, game, held, confirm);
    assert.equal(spot.facing, "side");
    scene.leave?.(game);
    game.message = message ? [...message] : null;
    game.returning = true;
    scene.enter!(game);
    assert.deepEqual(where(game), spot);
    // And there's no walking in through the door again.
    for (let i = 0; i < 30; i++) scene.update(game);
    assert.deepEqual(where(game), spot);
  });
}

test("arriving fresh, say off the map, starts you by the door again", () => {
  const { game, held, confirm } = fakeGame(settled());
  const scene = createClubScene(() => "you");
  const spot = standSomewhere(scene, game, held, confirm);
  game.returning = false;
  game.message = ["Somebody: You're back."];
  scene.enter!(game);
  assert.notDeepEqual([where(game).x, where(game).y], [spot.x, spot.y]);
});

test("coming round after a knockout starts you by the door, even from a fight here", () => {
  const { game, held, confirm } = fakeGame(settled());
  const scene = createClubScene(() => "you");
  const spot = standSomewhere(scene, game, held, confirm);
  game.returning = true;
  game.wokeUp = true;
  game.message = ["You come round."];
  scene.enter!(game);
  assert.notDeepEqual([where(game).x, where(game).y], [spot.x, spot.y]);
  assert.equal(game.wokeUp, false);
});
