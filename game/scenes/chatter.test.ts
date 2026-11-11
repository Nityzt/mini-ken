import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, wrapText } from "../art/font.ts";
import { createRunState, type RunState } from "../run-state.ts";
import { DOJOS } from "../world/dojos.ts";
import { GANG_STORIES, DIALOGUE_LINES, DIALOGUE_WIDTH } from "./content.ts";
import { AFTER_WINS, PEOPLE } from "./chatter-lines.ts";
import { afterWinLines, allChatterLines, homecoming, pendingNews, talkAbout, wakeUpLines } from "./chatter.ts";
import { newsFirst, talkToNao } from "./club-story.ts";

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

// Lines that remember what's happened (owner, 2026-11-11).
const newsFor = (state: RunState, who: string) => pendingNews(state, who)?.line ?? null;
/** Everything someone has to say right now, in the order they'd say it. */
const allNews = (state: RunState, who: string) => {
  const said: string[] = [];
  for (let next = pendingNews(state, who); next; next = pendingNews(next.run, who)) said.push(next.line);
  return said;
};

test("on a fresh save nobody remembers anything that hasn't happened", () => {
  for (const [who, person] of Object.entries(PEOPLE)) {
    for (const item of person.news) {
      // Sensei Kan always has something to say about your feet, and Bo about an empty purse, which a new save has.
      if ((who === "kan" && item.id === "feet") || (who === "bo" && item.id === "broke")) continue;
      assert.equal(item.when(run()), false, `${who}: ${item.line}`);
    }
  }
});

test("each senpai remembers the piece they gave you, and only that one", () => {
  const gave = run({ money: 50, armorFrom: { do: "aki", men: "yui", kote: "bo" } });
  assert.match(newsFor(gave, "aki")!, /^Aki: That do I gave you/);
  assert.match(newsFor(gave, "yui")!, /^Yui: The men I gave you/);
  assert.match(newsFor(gave, "bo")!, /^Bo: Mm\. The kote I gave you/);
  // Nobody claims a piece someone else gave.
  for (const who of ["aki", "bo", "yui"] as const) {
    const other = who === "aki" ? "bo" : "aki";
    assert.ok(!allNews(run({ armorFrom: { do: other, men: other, kote: other } }), who).some((line) => /gave you/.test(line)), who);
  }
});

test("a line about one cup never plays once you've won three", () => {
  for (const who of ["sensei", "momo"]) {
    assert.match(newsFor(run({ cups: ["pinecone"] }), who)!, /A cup/);
    assert.ok(!allNews(run({ cups: ["pinecone", "raccoon", "goose"] }), who).some((line) => /A cup[.!]/.test(line)), who);
  }
});

test("being carried home is remembered only once it's happened", () => {
  for (const who of ["sensei", "aki", "bo", "yui", "nao"]) {
    assert.ok(!allNews(run(), who).some((line) => /carried|shoulder/.test(line)), who);
    assert.ok(allNews(run({ talked: { wake: 1 } }), who).some((line) => /carried|shoulder/.test(line)), who);
  }
});

test("each rival talks about the one before them until you've beaten them, and about the next one after", () => {
  const afterSora = run({ beaten: ["raccoon"] });
  assert.ok(allNews(afterSora, "goose").some((line) => /Sora says you're good/.test(line)));
  assert.ok(!allNews(run({ beaten: ["raccoon", "goose"] }), "goose").some((line) => /Sora says/.test(line)));
  assert.ok(allNews(run({ beaten: ["raccoon", "goose"] }), "raccoon").some((line) => /beat Hana too/.test(line)));
  assert.ok(!allNews(afterSora, "raccoon").some((line) => /Hana/.test(line)));
  assert.ok(allNews(run({ beaten: ["goose"] }), "heron").some((line) => /you and Hana/.test(line)));
  assert.ok(!allNews(run({ beaten: ["goose", "heron"] }), "heron").some((line) => /you and Hana/.test(line)));
  assert.ok(allNews(run({ beaten: ["heron"] }), "otter").some((line) => /outlasted Mika/.test(line)));
  assert.ok(allNews(run({ beaten: ["otter"] }), "otter").some((line) => /Thunder Radish came all the way/.test(line)));
  assert.ok(!allNews(run({ beaten: ["otter", "radish"] }), "otter").some((line) => /Thunder Radish came/.test(line)));
});

test("Nao sends you to Momo at first, then remembers, and says each thing once", () => {
  assert.match(talkToNao(run()).lines[0], /Momo is on the left/);
  const ranked = run({ metSenpai: true, gi: true, gear: { ...run().gear, tare: true, shinai: true } });
  const first = talkToNao(ranked);
  assert.match(first.lines[0], /A tare, and a rank/);
  assert.ok(PEOPLE.nao.small.includes(talkToNao(first.run).lines[0]));
  // Once you're armored, the tare is old news.
  assert.doesNotMatch(talkToNao({ ...ranked, trained: true }).lines[0], /A tare/);
});

test("walking in off the road, Nao mentions what happened out there, once, and never anything from home", () => {
  assert.equal(homecoming(run({ metSenpai: true, gear: { ...run().gear, tare: true }, beaten: ["aki"], kirikaeshiPasses: 3 })), null);
  const cup = homecoming(run({ cups: ["raccoon"] }));
  assert.match(cup!.line, /won a cup/);
  assert.equal(homecoming(cup!.run), null);
  // What Nao already said at the door isn't news when you walk over.
  assert.ok(!allNews({ ...cup!.run, metSenpai: true }, "nao").some((line) => /won a cup/.test(line)));
  assert.match(homecoming(run({ champion: true, cups: ["grand"] }))!.line, /Champion/);
  assert.match(homecoming(run({ cleared: ["market"] }))!.line, /Alley Cats/);
});

test("news brought up at home isn't news again when you ask", () => {
  const said = newsFirst(run({ dan: 1, money: 50 }), "bo");
  assert.match(said.lines[0], /A dan/);
  assert.doesNotMatch(talkAbout(said.run, "bo", "news").lines[0], /A dan/);
  assert.deepEqual(newsFirst(run({ money: 50 }), "bo").lines, []);
});
