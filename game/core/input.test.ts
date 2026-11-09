import test from "node:test";
import assert from "node:assert/strict";
import { createInput, shouldCaptureKey } from "./input.ts";

function key(type: "keydown" | "keyup", k: string, extra: Record<string, unknown> = {}) {
  const e = new Event(type, { cancelable: true });
  return Object.assign(e, { key: k, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...extra });
}
const plain = { ctrlKey: false, metaKey: false, altKey: false };

test("a held key reads as down until released", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "j"));
  assert.equal(input.isDown("men"), true);
  t.dispatchEvent(key("keyup", "j"));
  assert.equal(input.isDown("men"), false);
});

test("blur clears held keys", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "j"));
  t.dispatchEvent(new Event("blur"));
  assert.equal(input.isDown("men"), false);
});

test("wasPressed is true for one tick only", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "k"));
  assert.equal(input.wasPressed("kote"), true);
  input.endTick();
  assert.equal(input.wasPressed("kote"), false);
  assert.equal(input.isDown("kote"), true);
});

test("ignores key repeat for wasPressed", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "l"));
  input.endTick();
  t.dispatchEvent(key("keydown", "l", { repeat: true }));
  assert.equal(input.wasPressed("do"), false);
});

test("releasing one of two keys for an action keeps it held", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "a"));
  t.dispatchEvent(key("keydown", "ArrowLeft"));
  t.dispatchEvent(key("keyup", "a"));
  assert.equal(input.isDown("left"), true);
});

test("caps lock does not change a key's action", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "J"));
  assert.equal(input.isDown("men"), true);
});

test("captured game keys cancel the browser default", () => {
  const t = new EventTarget();
  createInput(t);
  const e = key("keydown", "ArrowDown");
  t.dispatchEvent(e);
  assert.equal(e.defaultPrevented, true);
});

test("I holds seme", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "i"));
  assert.equal(input.isDown("seme"), true);
  t.dispatchEvent(key("keyup", "i"));
  assert.equal(input.isDown("seme"), false);
});

test("space stomps as well as confirms", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", " "));
  assert.equal(input.wasPressed("stomp"), true);
  assert.equal(input.wasPressed("confirm"), true);
  input.endTick();
  assert.equal(input.wasPressed("stomp"), false);
});

test("up and space have one job each", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "w"));
  assert.equal(input.isDown("up"), true);
  assert.equal(input.isDown("confirm"), false);
  t.dispatchEvent(key("keydown", " "));
  assert.equal(input.isDown("confirm"), true);
});

test("non-Latin layouts still strike, using the key's position", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "о", { code: "KeyJ" }));
  assert.equal(input.isDown("men"), true);
  assert.equal(input.wasPressed("men"), true);
});

test("an active Japanese IME still strikes", () => {
  const t = new EventTarget();
  const input = createInput(t);
  const e = key("keydown", "Process", { code: "KeyK" });
  t.dispatchEvent(e);
  assert.equal(input.isDown("kote"), true);
  assert.equal(e.defaultPrevented, true);
});

test("a key released under a different character still lets go", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "d", { code: "KeyD" }));
  t.dispatchEvent(key("keyup", "∂", { code: "KeyD" }));
  assert.equal(input.isDown("right"), false);
});

test("a Latin layout follows the printed letter, not the position", () => {
  const t = new EventTarget();
  const input = createInput(t);
  // On AZERTY the key printed A sits where QWERTY has Q.
  t.dispatchEvent(key("keydown", "a", { code: "KeyQ" }));
  assert.equal(input.isDown("left"), true);
});

test("shortcuts stay uncaptured on a non-Latin layout", () => {
  assert.equal(shouldCaptureKey({ key: "к", code: "KeyR", ctrlKey: true, metaKey: false, altKey: false, targetTag: null }), false);
});

test("dispose stops listening", () => {
  const t = new EventTarget();
  const input = createInput(t);
  input.dispose();
  t.dispatchEvent(key("keydown", "j"));
  assert.equal(input.isDown("men"), false);
});

test("shortcuts are not captured", () => {
  assert.equal(shouldCaptureKey({ key: "r", ctrlKey: true, metaKey: false, altKey: false, targetTag: null }), false);
  assert.equal(shouldCaptureKey({ key: "l", ctrlKey: false, metaKey: true, altKey: false, targetTag: null }), false);
  assert.equal(shouldCaptureKey({ key: "d", ctrlKey: false, metaKey: false, altKey: true, targetTag: null }), false);
});

test("activating keys on a focused link or button are not captured", () => {
  assert.equal(shouldCaptureKey({ key: "Enter", ...plain, targetTag: "A" }), false);
  assert.equal(shouldCaptureKey({ key: " ", ...plain, targetTag: "BUTTON" }), false);
});

test("game keys still work while a link or button keeps focus after a click", () => {
  assert.equal(shouldCaptureKey({ key: "j", ...plain, targetTag: "BUTTON" }), true);
});

test("Tab is never captured", () => {
  assert.equal(shouldCaptureKey({ key: "Tab", ...plain, targetTag: "BODY" }), false);
});

test("unmapped keys are not captured", () => {
  assert.equal(shouldCaptureKey({ key: "F5", ...plain, targetTag: "BODY" }), false);
});

test("game keys on the page are captured", () => {
  assert.equal(shouldCaptureKey({ key: "j", ...plain, targetTag: "BODY" }), true);
});

test("X cancels", () => {
  const target = new EventTarget();
  const input = createInput(target);
  const event = Object.assign(new Event("keydown"), { key: "x", code: "KeyX", repeat: false, ctrlKey: false, metaKey: false, altKey: false });
  target.dispatchEvent(event);
  assert.equal(input.wasPressed("cancel"), true);
  input.dispose();
});

test("P also pauses", () => {
  const t = new EventTarget();
  const input = createInput(t);
  t.dispatchEvent(key("keydown", "p"));
  assert.equal(input.wasPressed("pause"), true);
  input.dispose();
});

test("while typing, keys are text and don't work the controls", () => {
  const target = new EventTarget();
  const input = createInput(target);
  const press = (key: string, repeat = false) => {
    const event = Object.assign(new Event("keydown", { cancelable: true }), { key, code: "", repeat, ctrlKey: false, metaKey: false, altKey: false });
    target.dispatchEvent(event);
    return event;
  };
  input.setTyping(true);
  assert.equal(input.typing, true);
  for (const key of ["e", "x", "Escape", "Enter", " "]) assert.equal(press(key).defaultPrevented, true, key);
  assert.deepEqual([...input.typed()], ["e", "x", "Escape", "Enter", " "]);
  for (const action of ["confirm", "cancel", "pause", "stomp"] as const) assert.equal(input.wasPressed(action), false, action);
  input.endTick();
  assert.deepEqual([...input.typed()], []);

  press("e", true);
  assert.deepEqual([...input.typed()], [], "holding a letter doesn't run on");
  press("Backspace", true);
  assert.deepEqual([...input.typed()], ["Backspace"], "holding Backspace does");
  assert.equal(press("Tab").defaultPrevented, false, "keys that aren't text are left alone");

  input.setTyping(false);
  assert.deepEqual([...input.typed()], []);
  press("e");
  assert.equal(input.wasPressed("confirm"), true);
  input.dispose();
});

test("a form field gets its own keys, even with the game reading text", () => {
  const target = new EventTarget();
  const input = createInput(target as unknown as Window);
  input.setTyping(true);
  let prevented = false;
  const event = Object.assign(new Event("keydown"), { key: "a", code: "KeyA", ctrlKey: false, metaKey: false, altKey: false, repeat: false, preventDefault: () => (prevented = true) });
  Object.defineProperty(event, "target", { value: { tagName: "INPUT" } });
  target.dispatchEvent(event);
  assert.equal(prevented, false);
  assert.deepEqual(input.typed(), []);
  input.dispose();
});

test("custom bindings replace the old action and follow the new key", () => {
  const target = new EventTarget();
  const input = createInput(target);
  const bindings = input.bindings();
  input.setBindings({ ...bindings, men: ["u"] });
  target.dispatchEvent(key("keydown", "j"));
  assert.equal(input.isDown("men"), false);
  target.dispatchEvent(key("keydown", "u"));
  assert.equal(input.isDown("men"), true);
  input.dispose();
});

test('an unmapped Latin letter does not fall back to a different physical key', () => {
  const target = new EventTarget();
  const input = createInput(target);
  input.setBindings({ ...input.bindings(), wrist: ['u'] });
  target.dispatchEvent(key('keydown', 'q', { code: 'KeyA' }));
  assert.equal(input.isDown('left'), false);
  assert.equal(input.isDown('wrist'), false);
});
