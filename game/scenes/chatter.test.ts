import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, wrapText } from "../art/font.ts";
import { createRunState, type RunState } from "../run-state.ts";
import { DOJOS } from "../world/dojos.ts";
import { GANG_STORIES, DIALOGUE_LINES, DIALOGUE_WIDTH } from "./content.ts";
import { AFTER_WINS, PEOPLE } from "./chatter-lines.ts";
import { afterWinLines, allChatterLines, talkAbout, wakeUpLines } from "./chatter.ts";

const run = (over: Partial<RunState> = {}): RunState => ({ ...createRunState(), ...over });

test("every line fits in the box, in characters the font can draw", () => {
  for (const line of allChatterLines()) {
    assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
    for (const char of line) assert.ok(GLYPHS[char], `"${char}" in "${line}"`);
  }
});

test("no real club people or places, and no advertising", () => {
  const real = /\b(Ian|Qihan|Matthew|Wong|Lucas|Navarro|Belal|Aboulnaga|Daniel|Woo|Julie|Saleem|Khan|Miguel|Quiban|Nityam|Goyal|Simon|Choe|Shawn|Kim|Kiyoshi|Hao|Fuminori|Toyasaki|Ryan|Prendergast|Tadashi|Wakabayashi|Valiquette|Toronto|Waterloo|York)\b/;
  const pitch = /\b(register|sign up|join us|membership|tuition)\b/i;
  for (const line of allChatterLines()) {
    assert.equal(real.exec(line), null, line);
    assert.equal(pitch.exec(line), null, line);
  }
});

test("everyone you can talk to has something to say on every topic", () => {
  const dojoPeople = Object.values(DOJOS).flatMap((dojo) => [dojo.helperIds.G, dojo.helperIds.E, dojo.sensei.id]);
  const everyone = [...dojoPeople, "momo", "sensei", "aki", "bo", "yui", "radish", "goose", "raccoon", "heron", "otter", "tetsu", "shin", "gen", ...Object.keys(GANG_STORIES)];
  for (const who of everyone) {
    const person = PEOPLE[who];
    assert.ok(person, who);
    assert.ok(person.small.length >= 2, `${who} has too little to say`);
    assert.ok(person.advice.length >= 1, `${who} has no advice`);
    assert.ok(person.news.length >= 1, `${who} never notices anything`);
  }
});

test("each line starts with the name of whoever's saying it", () => {
  for (const [id, person] of Object.entries(PEOPLE)) {
    for (const line of [...person.small, ...person.advice, ...person.news.map((item) => item.line)]) {
      assert.ok(line.startsWith(`${person.name}: `), `${id}: ${line}`);
    }
  }
});

test("small talk goes all the way round before anything comes back", () => {
  let state = run();
  const heard: string[] = [];
  for (let i = 0; i < PEOPLE.aki.small.length; i++) {
    const reply = talkAbout(state, "aki", "chat");
    state = reply.run;
    heard.push(reply.lines[0]);
  }
  assert.equal(new Set(heard).size, PEOPLE.aki.small.length);
  assert.equal(talkAbout(state, "aki", "chat").lines[0], heard[0]);
});

test("that survives between conversations, because it's part of the save", () => {
  const first = talkAbout(run(), "bo", "chat");
  assert.deepEqual(first.run.talked, { "bo:chat": 1 });
});

test("news reacts to what you've done, and each thing is only said once", () => {
  const before = talkAbout(run(), "kei", "news");
  assert.ok(PEOPLE.kei.small.includes(before.lines[0]));
  const won = talkAbout(run({ beaten: ["radish"] }), "kei", "news");
  assert.match(won.lines[0], /beat Ren/);
  const again = talkAbout(won.run, "kei", "news");
  assert.doesNotMatch(again.lines[0], /beat Ren/);
});

test("what's most on someone's mind comes first", () => {
  assert.match(talkAbout(run({ hp: 10, beaten: ["radish"] }), "momo", "news").lines[0], /look awful/);
});

test("losing to someone gets noticed by the people around them", () => {
  assert.match(talkAbout(run({ losses: { goose: 1 } }), "pip", "news").lines[0], /arms way up high/);
  assert.match(talkAbout(run({ losses: { goose: 4 } }), "goose", "news").lines[0], /You again/);
});

test("someone holding your money keeps saying so until you've won it back", () => {
  const held = run({ held: { goose: 40 } });
  const first = talkAbout(held, "goose", "news");
  assert.match(first.lines[0], /^Hana: .*40 kensen/);
  assert.match(talkAbout(first.run, "goose", "news").lines[0], /40 kensen/);
  assert.doesNotMatch(talkAbout(run({ held: { heron: 40 } }), "goose", "news").lines[0], /still got your/);
});

test("every dojo head has something to say after you've beaten them, on your first win and after", () => {
  for (const head of Object.keys(DOJOS)) {
    assert.ok(AFTER_WINS[head]?.first.length, head);
    assert.ok(AFTER_WINS[head]?.again.length, head);
    assert.deepEqual(afterWinLines(run(), head, true, "Rei.").lines, ["Rei.", ...AFTER_WINS[head].first]);
    const a = afterWinLines(run(), head, false, "Rei.");
    const b = afterWinLines(a.run, head, false, "Rei.");
    assert.notEqual(a.lines[1], b.lines[1], head);
  }
});

test("waking up tells you what happened to your money, and gets less impressed", () => {
  const first = wakeUpLines(run(), 20, "the Alley Cats at Market Street");
  assert.match(first.lines.at(-1)!, /20 kensen lighter\. The Alley Cats/);
  const second = wakeUpLines(first.run, 0, "Hana");
  assert.notEqual(first.lines[0], second.lines[0]);
  assert.match(second.lines.at(-1)!, /empty/);
});
