import test from "node:test";
import assert from "node:assert/strict";
import { clearInvite, inviteFromUrl, inviteLink, nextInviteStep, stepCodeEntry } from "./invite.ts";

test("an invite comes from the page's address", () => {
  assert.equal(inviteFromUrl("?join=abc23"), "ABC23");
  assert.equal(inviteFromUrl("?join=O0I1L"), null);
  assert.equal(inviteFromUrl("?other=1"), null);
  assert.equal(inviteFromUrl(""), null);
});

test("an invite link is what the design says", () => {
  assert.equal(inviteLink("https://kendo.example", "ABC23"), "https://kendo.example/?join=ABC23");
});

test("using an invite takes it out of the address, so a refresh doesn't rejoin", () => {
  let replaced: unknown;
  clearInvite({ replaceState: (_state: unknown, _title: string, url?: string | URL | null) => void (replaced = url) }, { pathname: "/" });
  assert.equal(replaced, "/");
});

test("an invite waits through signing in and the tutorial", () => {
  assert.equal(nextInviteStep({ signedIn: false, open: false }), "sign-in");
  assert.equal(nextInviteStep({ signedIn: false, open: true }), "sign-in");
  assert.equal(nextInviteStep({ signedIn: true, open: false }), "tutorial");
  assert.equal(nextInviteStep({ signedIn: true, open: true }), "join");
});

test("typing a code only takes what a code can be", () => {
  const type = (keys: string[], text = "") => stepCodeEntry(text, keys);
  assert.deepEqual(type(["a", "0", "b", " ", "O"]), { text: "AB", done: null });
  assert.deepEqual(type(["2", "3", "4", "5", "6", "7"]), { text: "23456", done: null });
  assert.deepEqual(type(["Backspace"], "AB"), { text: "A", done: null });
  assert.deepEqual(type(["Enter"], "AB"), { text: "AB", done: null });
  assert.deepEqual(type(["Enter"], "AB234"), { text: "AB234", done: "join" });
  assert.deepEqual(type(["Escape"], "AB"), { text: "AB", done: "back" });
});
