import test from "node:test";
import assert from "node:assert/strict";
import { CLUB_MAP, GOOSE_MAP, HERON_MAP, OTTER_MAP, RACCOON_MAP, RIVAL_MAP } from "./levels.ts";
import { measureText } from "../art/font.ts";
import { activityAt, ACTIVITY_TICKS, chatAt, CHAT_LINES, CHAT_TICKS, crowdIn, crowdPose, keikoPose, KEIKO_CYCLE, nearestShown, rankTagShown, suburiPose, SUBURI_CYCLE, TAG_RANGE } from "./crowd.ts";

const ROOMS = { CLUB_MAP, RIVAL_MAP, RACCOON_MAP, HERON_MAP, OTTER_MAP, GOOSE_MAP };

test("every dojo has a group doing suburi and a pair in keiko", () => {
  for (const [name, room] of Object.entries(ROOMS)) {
    const crowd = crowdIn(room);
    assert.ok(crowd.filter((p) => p.activity === "suburi").length >= 3, name);
    assert.equal(crowd.filter((p) => p.activity === "keiko").length % 2, 0, `${name} has someone with no partner`);
    assert.ok(crowd.some((p) => p.activity === "keiko"), name);
  }
});

test("a suburi group all faces the same way, in the same place in the swing", () => {
  for (const room of Object.values(ROOMS)) {
    const group = crowdIn(room).filter((p) => p.activity === "suburi");
    assert.equal(new Set(group.map((p) => p.flip)).size, 1);
    assert.equal(new Set(group.map((p) => p.col)).size, 1, "shoulder to shoulder");
  }
});

test("suburi swings up and down, stepping forward on one cut and back on the next", () => {
  const poses = Array.from({ length: SUBURI_CYCLE }, (_, t) => suburiPose(t, false));
  assert.ok(poses.some((p) => p.held === "raised"));
  assert.ok(poses.some((p) => p.held === "strike"));
  assert.ok(poses.some((p) => p.dx > 0), "steps forward");
  assert.ok(poses.some((p) => p.dx === 0), "and back");
  assert.deepEqual(suburiPose(0, false), suburiPose(SUBURI_CYCLE, false));
});

test("a keiko pair face each other and take turns attacking", () => {
  const crowd = crowdIn(RIVAL_MAP).filter((p) => p.activity === "keiko");
  assert.deepEqual(crowd.map((p) => p.flip), [false, true]);
  const strikes: Record<0 | 1, number> = { 0: 0, 1: 0 };
  for (let t = 0; t < KEIKO_CYCLE * 2; t++) {
    const [a, b] = [keikoPose(t, 0, false), keikoPose(t, 1, false)];
    assert.ok(!(a.held === "strike" && b.held === "strike"), "only one attacks at a time");
    if (a.held === "strike") strikes[0]++;
    if (b.held === "strike") strikes[1]++;
  }
  assert.ok(strikes[0] > 0 && strikes[1] > 0);
});

test("with reduced motion, everyone holds still", () => {
  for (const t of [0, 25, 70, 200]) {
    assert.deepEqual(suburiPose(t, true), suburiPose(0, true));
    assert.deepEqual(keikoPose(t, 0, true), keikoPose(0, 0, true));
    assert.equal(keikoPose(t, 1, true).shout, false);
  }
});

test("rank tags only show on people you're close to, so a full room stays readable", () => {
  assert.equal(rankTagShown({ x: 100, y: 100 }, { x: 100 + TAG_RANGE, y: 100 }), true);
  assert.equal(rankTagShown({ x: 100, y: 100 }, { x: 100 + TAG_RANGE + 1, y: 100 }), false);
  assert.equal(rankTagShown({ x: 100, y: 100 }, { x: 100, y: 100 - TAG_RANGE - 1 }), false);
});

test("people side by side only show the nearest one's rank, so the tags don't run together", () => {
  const you = { x: 100, y: 50 };
  const row = [{ x: 84, y: 40 }, { x: 100, y: 40 }, { x: 116, y: 40 }];
  assert.equal(nearestShown(you, row), 1);
  assert.equal(nearestShown({ x: 120, y: 50 }, row), 2);
  assert.equal(nearestShown({ x: 100, y: 400 }, row), null);
});

test("a group keeps one activity for a fixed time, then picks again at random", () => {
  const seen = new Set<string>();
  for (let period = 0; period < 40; period++) {
    const at = period * ACTIVITY_TICKS;
    const activity = activityAt(7, 0, "suburi", at);
    assert.equal(activityAt(7, 0, "suburi", at + ACTIVITY_TICKS - 1), activity, "it lasts the whole period");
    seen.add(activity);
  }
  assert.ok(seen.size >= 3, [...seen].join());
  assert.ok(seen.has("suburi"), "they still drill most of the time");
});

test("it's random from one visit to the next, but the same seed gives the same day", () => {
  const day = (seed: number) => Array.from({ length: 12 }, (_, i) => activityAt(seed, 0, "keiko", i * ACTIVITY_TICKS)).join();
  assert.equal(day(3), day(3));
  assert.notEqual(day(3), day(4));
});

test("the people in a group all do the same thing at the same time", () => {
  const group = crowdIn(RIVAL_MAP).filter((p) => p.activity === "suburi");
  for (let t = 0; t < ACTIVITY_TICKS * 6; t += 113) {
    assert.equal(new Set(group.map((p) => JSON.stringify(crowdPose(p, t, false, 9)))).size, 1);
  }
});

test("when they're chatting, one talks at a time and they take turns", () => {
  const speakers = new Set<number>();
  let spoke = 0;
  for (let t = 0; t < CHAT_TICKS * 80; t += CHAT_TICKS) {
    const chat = chatAt(5, 1, 4, t);
    if (!chat) continue;
    spoke++;
    assert.ok(chat.speaker >= 0 && chat.speaker < 4);
    speakers.add(chat.speaker);
    assert.ok(CHAT_LINES.includes(chat.line));
  }
  assert.ok(spoke > 10);
  assert.ok(speakers.size > 1);
});

test("what they say fits over their heads", () => {
  for (const line of CHAT_LINES) assert.ok(measureText(line) <= 80, line);
});
