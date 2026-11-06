import test from "node:test";
import assert from "node:assert/strict";
import { createPauseMenu, menuItems, stepPauseMenu, type MenuKeys, type PauseMenu } from "./pause-menu.ts";

const keys = (pressed: Partial<MenuKeys> = {}): MenuKeys => ({ up: false, down: false, confirm: false, cancel: false, ...pressed });
const inFight = menuItems({ forfeit: "Forfeit match", inGame: true, hasTare: false });
const onMap = menuItems({ forfeit: null, inGame: true, hasTare: false });
const onTitle = menuItems({ forfeit: null, inGame: false, hasTare: false });

const choose = (menu: PauseMenu, items: typeof inFight, id: string): PauseMenu => ({ ...menu, choice: items.findIndex((i) => i.id === id) });

test("the menu offers forfeiting only while there's a fight to forfeit", () => {
  assert.deepEqual(inFight.map((i) => i.id), ["resume", "progress", "inventory", "challenges", "controls", "forfeit", "restart"]);
  assert.equal(inFight[5].label, "Forfeit match");
  assert.deepEqual(onMap.map((i) => i.id), ["resume", "progress", "inventory", "challenges", "controls", "restart"]);
});

test("the title screen has nothing to restart", () => {
  assert.deepEqual(onTitle.map((i) => i.id), ["resume", "controls"]);
});

test("up and down move through the items and wrap around", () => {
  let m = createPauseMenu();
  assert.equal(m.choice, 0);
  m = stepPauseMenu(m, onMap, keys({ down: true })).menu;
  assert.equal(m.choice, 1);
  m = stepPauseMenu(m, onMap, keys({ up: true })).menu;
  m = stepPauseMenu(m, onMap, keys({ up: true })).menu;
  assert.equal(m.choice, onMap.length - 1);
});

test("the first item resumes", () => {
  assert.equal(stepPauseMenu(createPauseMenu(), onMap, keys({ confirm: true })).action, "resume");
});

test("forfeit takes effect straight away", () => {
  const m = choose(createPauseMenu(), inFight, "forfeit");
  assert.equal(stepPauseMenu(m, inFight, keys({ confirm: true })).action, "forfeit");
});

test("the progress page opens and comes back", () => {
  const m = choose(createPauseMenu(), onMap, "progress");
  const open = stepPauseMenu(m, onMap, keys({ confirm: true }));
  assert.equal(open.action, null);
  assert.equal(open.menu.page, "progress");
  assert.equal(stepPauseMenu(open.menu, onMap, keys({ confirm: true })).menu.page, "main");
  assert.equal(stepPauseMenu(open.menu, onMap, keys({ cancel: true })).menu.page, "main");
});

test("restarting asks first, and the safe answer is the default", () => {
  const m = choose(createPauseMenu(), onMap, "restart");
  const asked = stepPauseMenu(m, onMap, keys({ confirm: true }));
  assert.equal(asked.action, null);
  assert.equal(asked.menu.page, "confirm");
  assert.equal(asked.menu.choice, 0);
  const no = stepPauseMenu(asked.menu, onMap, keys({ confirm: true }));
  assert.equal(no.action, null);
  assert.equal(no.menu.page, "main");
});

test("restart only happens after saying yes", () => {
  const m = choose(createPauseMenu(), onMap, "restart");
  let step = stepPauseMenu(m, onMap, keys({ confirm: true }));
  step = stepPauseMenu(step.menu, onMap, keys({ down: true }));
  assert.equal(step.action, null);
  assert.equal(stepPauseMenu(step.menu, onMap, keys({ confirm: true })).action, "restart");
});

test("X backs out of the question", () => {
  const m = choose(createPauseMenu(), onMap, "restart");
  const asked = stepPauseMenu(m, onMap, keys({ confirm: true })).menu;
  const back = stepPauseMenu(asked, onMap, keys({ cancel: true }));
  assert.equal(back.action, null);
  assert.equal(back.menu.page, "main");
});

test("X on the main page just resumes", () => {
  assert.equal(stepPauseMenu(createPauseMenu(), onMap, keys({ cancel: true })).action, "resume");
});

test("a choice left over from a longer menu stays in range", () => {
  const m: PauseMenu = { page: "main", choice: 9 };
  assert.equal(stepPauseMenu(m, onMap, keys()).menu.choice, onMap.length - 1);
});

test("the insignia can be changed from the menu once you own a tare", () => {
  const items = menuItems({ forfeit: null, inGame: true, hasTare: true });
  assert.ok(items.some((i) => i.id === "insignia"));
  assert.ok(!onMap.some((i) => i.id === "insignia"));
  const at = items.findIndex((i) => i.id === "insignia");
  assert.equal(stepPauseMenu({ page: "main", choice: at }, items, { up: false, down: false, confirm: true, cancel: false }).action, "insignia");
});

test("the controls page opens and comes back to where it was", () => {
  const at = onMap.findIndex((i) => i.id === "controls");
  const open = stepPauseMenu({ page: "main", choice: at }, onMap, { up: false, down: false, confirm: true, cancel: false }).menu;
  assert.equal(open.page, "controls");
  const back = stepPauseMenu(open, onMap, { up: false, down: false, confirm: false, cancel: true }).menu;
  assert.deepEqual(back, { page: "main", choice: at });
});

test("the inventory is a page of its own: arrows move through it, and only a usable item does anything", () => {
  const items = menuItems({ forfeit: null, inGame: true, hasTare: false });
  const open = stepPauseMenu({ page: "main", choice: items.findIndex((i) => i.id === "inventory") }, items, keys({ confirm: true }));
  assert.equal(open.menu.page, "inventory");
  const held = ["ticket", "gi", "tare"] as const;
  const moved = stepPauseMenu(open.menu, items, keys({ right: true }), [...held]);
  assert.equal(moved.menu.choice, 1);
  assert.equal(stepPauseMenu(moved.menu, items, keys({ confirm: true }), [...held]).action, null);
  assert.equal(stepPauseMenu(open.menu, items, keys({ confirm: true }), [...held]).action, "use-ticket");
  const back = stepPauseMenu(moved.menu, items, keys({ cancel: true }), [...held]);
  assert.equal(back.menu.page, "main");
  assert.equal(items[back.menu.choice].id, "inventory");
  assert.equal(stepPauseMenu(open.menu, items, keys({ down: true }), []).menu.choice, 0, "an empty inventory doesn't break");
});

test("anything wearable can be put on from the inventory", () => {
  const items = menuItems({ forfeit: null, inGame: true, hasTare: false });
  const held = ["gi", "shop:gooseColors"];
  const actionFor = (id: string) => (id.startsWith("shop:") ? ("wear" as const) : null);
  assert.equal(stepPauseMenu({ page: "inventory", choice: 1 }, items, keys({ confirm: true }), held, actionFor).action, "wear");
  assert.equal(stepPauseMenu({ page: "inventory", choice: 0 }, items, keys({ confirm: true }), held, actionFor).action, null);
});

test("the challenges page opens and closes like the others", () => {
  const items = menuItems({ forfeit: null, inGame: true, hasTare: false });
  const open = stepPauseMenu({ page: "main", choice: items.findIndex((i) => i.id === "challenges") }, items, keys({ confirm: true }));
  assert.equal(open.menu.page, "challenges");
  assert.equal(stepPauseMenu(open.menu, items, keys({ cancel: true })).menu.page, "main");
});

test("there's no inventory on the title screen", () => {
  assert.equal(menuItems({ forfeit: null, inGame: false, hasTare: false }).some((i) => i.id === "inventory"), false);
});

test("outside any story there's nothing to restart, but a match can still be conceded", () => {
  const items = menuItems({ forfeit: "Concede", inGame: false, hasTare: false }).map((i) => i.id);
  assert.deepEqual(items, ["resume", "controls", "forfeit"]);
  assert.deepEqual(menuItems({ forfeit: null, inGame: false, hasTare: false }).map((i) => i.id), ["resume", "controls"]);
});

test("multiplayer shows up in the story menu only once it's open", () => {
  assert.ok(menuItems({ forfeit: null, inGame: true, hasTare: true, multiplayer: true }).some((i) => i.id === "multiplayer"));
  assert.ok(!menuItems({ forfeit: null, inGame: true, hasTare: true }).some((i) => i.id === "multiplayer"));
});

test("the inventory is a grid: arrows move across it and between its groups, and nothing wraps", () => {
  const items = menuItems({ forfeit: null, inGame: true, hasTare: false });
  const groups = [["ticket", "letter"], ["gi", null, "shinai"], ["shop:inkColors"]];
  const held = groups.flat().filter((slot): slot is string => slot !== null);
  const go = (choice: number, pressed: Partial<MenuKeys>) => stepPauseMenu({ page: "inventory", choice }, items, keys(pressed), held, undefined, groups).menu.choice;
  assert.equal(go(0, { right: true }), 1);
  assert.equal(go(1, { right: true }), 2, "on into the next group");
  assert.equal(go(0, { left: true }), 0, "no wrapping off the start");
  assert.equal(go(0, { down: true }), 2, "straight down is the gear row");
  assert.equal(go(3, { down: true }), 4, "then the colors");
  assert.equal(go(4, { down: true }), 4, "and that's the bottom");
  assert.equal(go(3, { up: true }), 1);
});

test("the progress page opens on the map at what's next, and the arrows switch pages", () => {
  const items = menuItems({ forfeit: null, inGame: true, hasTare: false });
  const at = items.findIndex((i) => i.id === "progress");
  const open = stepPauseMenu({ page: "main", choice: at }, items, keys({ confirm: true }), [], undefined, undefined, { goal: 4, rows: 20 });
  assert.deepEqual(open.menu, { page: "progress", choice: 4, tab: 2 });
  const left = stepPauseMenu(open.menu, items, keys({ left: true })).menu;
  assert.equal(left.tab, 1);
  assert.equal(stepPauseMenu(left, items, keys({ left: true })).menu.tab, 0);
  assert.equal(stepPauseMenu({ ...left, tab: 0 }, items, keys({ left: true })).menu.tab, 2, "pages wrap");
  assert.equal(stepPauseMenu({ ...left, tab: 2 }, items, keys({ right: true })).menu.tab, 0);
  assert.equal(stepPauseMenu(left, items, keys({ cancel: true })).menu.page, "main");
});

test("up and down walk the map and stop at both ends; on the other pages they leave the row alone", () => {
  const items = menuItems({ forfeit: null, inGame: true, hasTare: false });
  const progress = { goal: 0, rows: 5 };
  const map = (choice: number, pressed: Partial<MenuKeys>, tab = 2) => stepPauseMenu({ page: "progress", choice, tab }, items, keys(pressed), [], undefined, undefined, progress).menu.choice;
  assert.equal(map(2, { down: true }), 3);
  assert.equal(map(4, { down: true }), 4);
  assert.equal(map(0, { up: true }), 0);
  assert.equal(map(2, { down: true }, 0), 2);
});

test("a guest can sign in from the story menu, and it's an action the game handles", () => {
  const items = menuItems({ forfeit: null, inGame: true, hasTare: false, multiplayer: true, signIn: true });
  const index = items.findIndex((i) => i.id === "sign-in");
  assert.ok(index >= 0);
  assert.ok(index < items.findIndex((i) => i.id === "restart"));
  assert.equal(stepPauseMenu({ page: "main", choice: index }, items, { up: false, down: false, confirm: true, cancel: false }).action, "sign-in");
  assert.ok(!menuItems({ forfeit: null, inGame: true, hasTare: false }).some((i) => i.id === "sign-in"));
  assert.ok(!menuItems({ forfeit: null, inGame: false, hasTare: false, signIn: true }).some((i) => i.id === "sign-in"));
});
