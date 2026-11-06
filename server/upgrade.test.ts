import test from "node:test";
import assert from "node:assert/strict";
import { upgradeTarget } from "./upgrade.ts";

test("an upgrade goes to the relay, to Next in development, and nowhere otherwise", () => {
  assert.equal(upgradeTarget("/ws", true), "relay");
  assert.equal(upgradeTarget("/ws?x=1", false), "relay");
  assert.equal(upgradeTarget("/_next/webpack-hmr", true), "next");
  assert.equal(upgradeTarget("/_next/webpack-hmr", false), "refuse");
});

test("a malformed address is refused, rather than throwing", () => {
  for (const url of ["//", "http://", "/\\\\", undefined]) assert.equal(upgradeTarget(url, false), "refuse", String(url));
});
