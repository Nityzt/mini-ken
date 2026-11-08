import test from "node:test";
import { directDuel as createDuel } from "../duel/test-support.ts";
import assert from "node:assert/strict";
import { GLYPHS, measureText, wrapText } from "../art/font.ts";
import { STAGE_H, STAGE_W } from "../core/scale.ts";
import type { Action, Input } from "../core/input.ts";
import type { Game } from "../core/scene.ts";
import { RANGE_MAX } from "../duel/constants.ts";
import { distance, skipBow, type DuelState } from "../duel/rules.ts";
import { createRunState } from "../run-state.ts";
import { lessonsFor, SENPAI_IDS, type Session } from "./curriculum.ts";
import { createDuelScene } from "./duel.ts";
import { CARD_TEXT_W, CARD_W, cardHeight, createTeachCards, keysLines, keysWidth, READ_TICKS, type TeachCard } from "./teach-card.ts";
import { BRAWL_CARD, duelMoments, KIRIKAESHI_CARD, LINE_CARD, LINE_NO_KEYS_CARD, momentCard, teachOnce, tipCard, wasTaught } from "./teaching.ts";
import { createBrawlScene } from "./brawl.ts";
import { createKirikaeshiScene } from "./kirikaeshi.ts";
import { createLineScene } from "./line.ts";
import { createTrainingScene } from "./training.ts";

const fakeInput = () => {
  const pressed = new Set<Action>();
  let held: Action[] = [];
  const input = {
    isDown: (action: Action) => held.includes(action),
    wasPressed: (action: Action) => pressed.has(action),
    typing: false,
    setTyping() {},
    typed: () => [],
    endTick: () => pressed.clear(),
    clear: () => pressed.clear(),
    dispose() {},
  } as Input;
  return { input, press: (...actions: Action[]) => actions.forEach((a) => pressed.add(a)), release: () => pressed.clear(), hold: (...actions: Action[]) => { held = actions; } };
};

const fakeGame = (over: Partial<Game> = {}) => {
  const keys = fakeInput();
  const game = {
    input: keys.input,
    reducedMotion: true,
    run: createRunState(),
    audio: { play() {} },
    debug: {},
    message: null,
    after: [],
    session: null,
    versus: null,
    tournament: null,
    grading: null,
    bet: 0,
    go() {},
    showCards: (then: () => void) => then(),
    ...over,
  } as unknown as Game;
  return { game, ...keys };
};

const CARD: TeachCard = { title: "A", text: "b", keys: [] };

test("the first match explains its objective and what makes a point", () => {
  const card = momentCard("firstMatch", skipBow(createDuel()));
  assert.match(card.text, /two points/i);
  assert.match(card.text, /stomp/i);
  assert.match(card.text, /slide through/i);
  assertFits(card);
  const onePoint = skipBow(createDuel({ pointsToWin: 1 }));
  assert.match(momentCard("firstMatch", onePoint).text, /one point/i);
});

const ALL_SESSIONS: Session[] = [
  { kind: "sensei", round: 0 },
  { kind: "sensei", round: 1 },
  { kind: "sensei", round: 2 },
  ...SENPAI_IDS.flatMap((senpai) => [0, 1, 2].map((level): Session => ({ kind: "senpai", senpai, level }))),
  { kind: "waza" },
  { kind: "quick" },
  { kind: "master" },
];
const lessons = ALL_SESSIONS.flatMap(lessonsFor);

const assertFits = (card: TeachCard) => {
  assert.ok(measureText(card.title) * 2 <= CARD_TEXT_W, `title: ${card.title}`);
  assert.ok(keysWidth(card.keys) <= CARD_TEXT_W, `keys: ${card.title} ${keysWidth(card.keys)}`);
  assert.ok(cardHeight(card) <= STAGE_H, `height: ${card.title} ${cardHeight(card)}`);
  assert.ok(CARD_W <= STAGE_W);
  for (const line of wrapText(card.text, CARD_TEXT_W)) assert.ok(measureText(line) <= CARD_TEXT_W, line);
  for (const char of [card.title, card.text, ...card.keys.flat()].join("")) assert.ok(GLYPHS[char] || char === " ", `"${char}" in ${card.title}`);
};

test("a card waits for you, and a press in the first moment doesn't wave it away", () => {
  const { game, press, release } = fakeGame();
  const cards = createTeachCards();
  cards.show(game, CARD);
  for (let i = 0; i < READ_TICKS; i++) {
    press("confirm");
    cards.update(game);
    release();
    assert.equal(cards.active, true, `tick ${i}`);
  }
  for (let i = 0; i < 500; i++) cards.update(game);
  assert.equal(cards.active, true, "it never times out");
  press("confirm");
  cards.update(game);
  assert.equal(cards.active, false);
});

test("the keys a fight uses don't dismiss a card", () => {
  const { game, press } = fakeGame();
  const cards = createTeachCards();
  cards.show(game, CARD);
  for (let i = 0; i < READ_TICKS; i++) cards.update(game);
  press("men", "kote", "do", "down", "left", "right", "seme");
  cards.update(game);
  assert.equal(cards.active, true);
});

test("cards that come up together take turns, and each gets its own time to read", () => {
  const { game, press } = fakeGame();
  const cards = createTeachCards();
  cards.show(game, { ...CARD, title: "first" });
  cards.show(game, { ...CARD, title: "second" });
  assert.equal(game.debug.teachCard, "first");
  for (let i = 0; i < READ_TICKS; i++) cards.update(game);
  press("confirm");
  cards.update(game);
  assert.equal(cards.showing?.title, "second");
  assert.equal(game.debug.teachCard, "second");
  assert.equal(cards.ready, false);
});

test("teachOnce shows a card once a save, and remembers it in the save", () => {
  const { game } = fakeGame();
  const cards = createTeachCards();
  teachOnce(game, cards, "lock", CARD);
  assert.equal(cards.active, true);
  assert.ok(wasTaught(game.run, "lock"));
  cards.clear(game);
  teachOnce(game, cards, "lock", CARD);
  assert.equal(cards.active, false);
});

test("every drill has a card that fits on screen, naming keys, with a bottom line that fits too and loses no keys", () => {
  assert.ok(lessons.length > 20);
  for (const lesson of lessons) {
    assert.ok(lesson.title, lesson.id);
    assert.ok(lesson.keys.length > 0, lesson.id);
    assertFits({ title: lesson.title, text: lesson.prompt, keys: lesson.keys });
    for (const line of keysLines(lesson.keys)) assert.ok(measureText(line) <= STAGE_W - 8, `${lesson.id}: ${line}`);
    for (const [key, does] of lesson.keys) assert.ok(keysLines(lesson.keys).some((line) => line.includes(`${key} ${does}`)), `${lesson.id} loses ${key}`);
  }
});

test("a drill's card names every key its words tell you to press", () => {
  for (const lesson of lessons) {
    const named = lesson.keys.flatMap(([key]) => key.split(/[ +]+/));
    for (const key of lesson.prompt.match(/\b[JKLSDAI]\b(?= and |,|\.| to | twice| until| as|$)/g) ?? []) assert.ok(named.includes(key), `${lesson.id} says ${key}: ${lesson.prompt}`);
  }
});

test("every other card fits on screen, on either side of the court", () => {
  for (const card of [KIRIKAESHI_CARD, LINE_CARD, LINE_NO_KEYS_CARD, BRAWL_CARD, tipCard("Jodan reaches further, so step inside it. When their hands pull back, hit kote.")]) assertFits(card);
  for (const crossed of [false, true]) {
    const duel = skipBow(createDuel());
    duel.crossed = crossed;
    duel.fighters[1].attack = "men";
    for (const moment of ["firstMatch", "tell", "parry", "lock", "cross"] as const) assertFits(momentCard(moment, duel));
  }
});

test("the lock and the follow-through name the key that goes toward them, whichever side you're on", () => {
  const duel = skipBow(createDuel());
  assert.deepEqual(momentCard("lock", duel).keys[0], ["D", "hold to push"]);
  assert.deepEqual(momentCard("cross", { ...duel, crossed: true }).keys[0], ["A", "walk back in"]);
});

test("a tell's card names the key that answers this strike", () => {
  const duel = skipBow(createDuel());
  duel.fighters[1].stance = "windup";
  duel.fighters[1].attack = "bigMen";
  assert.equal(momentCard("tell", duel).keys[0][0], "L + Space");
});

const moments = (duel: DuelState, waza = false, tellsShown = true) => duelMoments(duel, { waza, tellsShown });

test("nothing's explained during the bow, because the fight hasn't started", () => {
  assert.deepEqual(moments(createDuel()), []);
  assert.deepEqual(moments(skipBow(createDuel())), ["firstMatch", "openings"]);
});

test("a tell only needs explaining in fights that show its prompt", () => {
  const duel = skipBow(createDuel());
  duel.fighters[1].stance = "windup";
  duel.fighters[1].attack = "men";
  duel.fighters[1].stanceTicks = 60;
  assert.ok(moments(duel).includes("tell"));
  assert.ok(!moments(duel, false, false).includes("tell"));
});

test("the parry, the lock and crossing come up when they happen, unless Sensei's already taught them", () => {
  const duel = skipBow(createDuel());
  duel.fighters[1].stance = "windup";
  duel.fighters[1].attack = "men";
  duel.fighters[1].stanceTicks = 5;
  duel.events = [{ type: "lock" }, { type: "cross" }];
  const fresh = moments(duel, false, false);
  for (const moment of ["parry", "lock", "cross"] as const) assert.ok(fresh.includes(moment), moment);
  assert.deepEqual(moments(duel, true, false), ["firstMatch", "openings"]);
});

test("a drill doesn't start until you've read its card", () => {
  const { game, press, release } = fakeGame({ session: { kind: "sensei", round: 1 } });
  const scene = createTrainingScene(() => "you");
  scene.enter!(game);
  assert.equal(game.debug.teachCard, "Block");
  const before = structuredClone(game.debug.duel);
  for (let i = 0; i < 600; i++) scene.update(game);
  assert.deepEqual(game.debug.duel, before, "the partner hasn't moved");
  press("confirm");
  scene.update(game);
  release();
  assert.equal(game.debug.teachCard, null);
  for (let i = 0; i < 5; i++) scene.update(game);
  assert.notDeepEqual((game.debug.duel as DuelState).fighters[1].stance, (before as DuelState).fighters[1].stance);
});

test("each new drill in a session gets its own card", () => {
  const { game, press, release, hold } = fakeGame({ session: { kind: "sensei", round: 0 } });
  const scene = createTrainingScene(() => "you");
  scene.enter!(game);
  assert.equal(game.debug.teachCard, "Suriashi");
  press("confirm");
  for (let i = 0; i <= READ_TICKS; i++) scene.update(game);
  release();
  assert.equal(game.debug.teachCard, null);
  // In, out and back in again, which is all the first drill asks.
  const duel = () => game.debug.duel as DuelState;
  const walkUntil = (action: Action, there: () => boolean) => {
    hold(action);
    for (let i = 0; i < 2000 && !there(); i++) scene.update(game);
    hold();
    assert.ok(there(), `walking ${action}`);
  };
  walkUntil("right", () => distance(duel()) <= RANGE_MAX);
  walkUntil("left", () => distance(duel()) >= RANGE_MAX + 12);
  walkUntil("right", () => game.debug.teachCard === "Openings");
  assert.equal(game.debug.lesson, "opening");
});

test("a first match freezes as the fight starts, with the rival waiting, then goes on when you say", () => {
  const { game, press, release } = fakeGame({ versus: "aki" });
  const scene = createDuelScene();
  scene.enter!(game);
  press("confirm");
  scene.update(game);
  release();
  assert.equal(game.debug.teachCard, "Your first match");
  const before = structuredClone(game.debug.duel) as DuelState;
  assert.equal(before.phase, "fight");
  for (let i = 0; i < 600; i++) scene.update(game);
  assert.deepEqual(game.debug.duel, before);
  // Space is the stomp too, and the press that closes the card mustn't reach the fight.
  press("confirm", "stomp");
  scene.update(game);
  release();
  assert.equal(game.debug.teachCard, null);
  assert.deepEqual(game.debug.duel, before);
  let moved = false;
  for (let i = 0; i < 400 && !moved; i++) {
    scene.update(game);
    moved = (game.debug.duel as DuelState).fighters[1].x !== before.fighters[1].x || (game.debug.duel as DuelState).fighters[1].stance !== before.fighters[1].stance;
  }
  assert.ok(moved, "the rival's moving again");
  assert.ok(wasTaught(game.run, "firstMatch"));
});

test("the second match has no first-match card", () => {
  const { game, press, release } = fakeGame({ versus: "aki" });
  game.run = { ...game.run, seen: ["taught:firstMatch", "taught:openings"] };
  const scene = createDuelScene();
  scene.enter!(game);
  press("confirm");
  scene.update(game);
  release();
  assert.equal(game.debug.teachCard, null);
});

/** Enough of a canvas to run a scene's whole render, noting each rectangle drawn. */
function recordingCtx() {
  const rects: number[][] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, name) {
      if (name === "fillRect") return (...args: number[]) => rects.push(args);
      if (name === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (name === "measureText") return () => ({ width: 0 });
      if (name in target) return target[name as string];
      return () => ctx;
    },
    set(target, name, value) {
      target[name as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  // Sprites are cached on canvases of their own, and those don't need to come out as anything here.
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  return { ctx, rects };
}

for (const [name, create, over] of [
  ["a drill", () => createTrainingScene(() => "you"), { session: { kind: "sensei", round: 0 } }],
  ["kirikaeshi", createKirikaeshiScene, {}],
  ["the line drill", createLineScene, {}],
  ["a street fight", createBrawlScene, {}],
] as const) {
  test(`${name} really draws the card that's holding it still`, () => {
    const { game } = fakeGame(over as Partial<Game>);
    const scene = create();
    scene.enter!(game);
    assert.ok(game.debug.teachCard, "a card is up");
    const { ctx, rects } = recordingCtx();
    scene.render(ctx, game);
    assert.ok(rects.some(([x, y, w]) => x === 0 && y === 0 && w === CARD_W), "its frame was drawn");
  });
}

test("a match really draws the card that's holding it still", () => {
  const { game, press, release } = fakeGame({ versus: "aki" });
  const scene = createDuelScene();
  scene.enter!(game);
  press("confirm");
  scene.update(game);
  release();
  assert.ok(game.debug.teachCard);
  const { ctx, rects } = recordingCtx();
  scene.render(ctx, game);
  assert.ok(rects.some(([x, y, w]) => x === 0 && y === 0 && w === CARD_W));
});
