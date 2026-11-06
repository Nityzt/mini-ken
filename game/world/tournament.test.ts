import test from "node:test";
import assert from "node:assert/strict";
import { CUP_IDS, CUPS, createTournament, cupAt, ENTRANT_COUNT, nextOpponent, recordMatch, roundName, type CupId, type Tournament } from "./tournament.ts";

const grand = (seed = 1) => createTournament("grand", seed, "Haru");
const ids = (field: { id: string }[]) => field.map((entrant) => entrant.id);
const YOU = "you";
const winAll = (t: Tournament): Tournament => {
  let current = t;
  while (current.status === "playing") current = recordMatch(current, true);
  return current;
};

test("the Grand Taikai has eight people, with you among them", () => {
  const t = grand();
  assert.equal(ENTRANT_COUNT, 8);
  assert.equal(new Set(ids(t.rounds[0])).size, 8);
  assert.ok(ids(t.rounds[0]).includes(YOU));
});

test("all five rival dojos send someone to the Grand Taikai", () => {
  for (const id of ["radish", "goose", "raccoon", "heron", "otter"]) assert.ok(ids(grand().rounds[0]).includes(id), id);
});

test("Momo never enters: that fight is rigged", () => {
  for (const cup of CUP_IDS) for (let seed = 0; seed < 30; seed++) assert.equal(ids(createTournament(cup, seed, "Haru").rounds[0]).includes("momo"), false);
});

test("each dojo's cup has four people, and you win it in two matches", () => {
  for (const cup of CUP_IDS.filter((id) => id !== "grand")) {
    const t = winAll(createTournament(cup, 3, "Haru"));
    assert.equal(t.rounds[0].length, 4, cup);
    assert.equal(t.status, "champion", cup);
    assert.equal(t.round, 1, cup);
  }
});

test("three wins take the Grand Taikai", () => {
  const t = winAll(grand());
  assert.equal(t.status, "champion");
  assert.equal(t.round, 2);
  assert.deepEqual(ids(t.rounds[3]), [YOU]);
});

test("the host is always waiting in the final, and you never meet them sooner", () => {
  const hosts: [CupId, string][] = [["grand", "radish"], ["raccoon", "raccoon"], ["goose", "goose"], ["heron", "heron"], ["otter", "otter"], ["radish", "radish"]];
  for (const [cup, host] of hosts) {
    for (let seed = 0; seed < 40; seed++) {
      let t = createTournament(cup, seed, "Haru");
      while (t.rounds[t.round].length > 2) {
        assert.notEqual(nextOpponent(t)?.id, host, `${cup} seed ${seed}`);
        t = recordMatch(t, true);
      }
      assert.equal(nextOpponent(t)?.id, host, `${cup} seed ${seed}`);
    }
  }
});

test("exactly one entrant is you, and the rest are bots standing in for other dojos", () => {
  for (const cup of CUP_IDS) {
    const field = createTournament(cup, 5, "Haru").rounds[0];
    assert.equal(field.filter((e) => e.controller === "player").length, 1, cup);
    assert.equal(field.find((e) => e.controller === "player")?.name, "Haru", cup);
    for (const e of field.filter((entrant) => entrant.controller === "bot")) {
      assert.ok(e.fighter, e.id);
      assert.ok(e.dojo.length > 0, e.id);
    }
  }
});

test("a dojo's cup brings in people from outside the host's dojo where it can", () => {
  const dojos = new Set(createTournament("goose", 1, "Haru").rounds[0].map((e) => e.dojo));
  assert.ok(dojos.size >= 3, [...dojos].join());
});

test("a bracket is plain data, so it could be saved or sent somewhere", () => {
  const t = recordMatch(grand(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(t)), t);
});

test("each venue hosts its own cup", () => {
  assert.equal(cupAt("pinecone"), "pinecone");
  assert.equal(cupAt("goose"), "goose");
  assert.equal(cupAt("grandArena"), "grand");
  for (const id of CUP_IDS) assert.equal(cupAt(CUPS[id].venue), id);
});

test("one loss and you're out", () => {
  const t = recordMatch(grand(), false);
  assert.equal(t.status, "out");
  assert.equal(t.round, 0);
  assert.equal(nextOpponent(t), null);
});

test("each round halves the field, and you're in it for as long as you keep winning", () => {
  let t = grand(3);
  t = recordMatch(t, true);
  assert.equal(t.rounds[1].length, 4);
  assert.ok(ids(t.rounds[1]).includes(YOU));
  t = recordMatch(t, true);
  assert.deepEqual(ids(t.rounds[2]).sort(), ["radish", YOU].sort());
});

test("your next opponent really is who the bracket pairs you with", () => {
  for (let seed = 0; seed < 20; seed++) {
    let t = grand(seed);
    while (t.status === "playing") {
      const field = t.rounds[t.round];
      const at = ids(field).indexOf(YOU);
      assert.equal(nextOpponent(t)?.id, field[at % 2 === 0 ? at + 1 : at - 1].id);
      t = recordMatch(t, true);
    }
  }
});

test("the same seed draws the same bracket, and others draw differently", () => {
  assert.deepEqual(grand(7), grand(7));
  const draws = new Set(Array.from({ length: 10 }, (_, seed) => JSON.stringify(ids(grand(seed).rounds[0]))));
  assert.ok(draws.size > 1);
});

test("recordMatch doesn't change the state it was given", () => {
  const t = grand();
  const before = structuredClone(t);
  recordMatch(t, true);
  assert.deepEqual(t, before);
});

test("every entrant has a short name, and rounds are named by how many are left", () => {
  for (const cup of CUP_IDS) for (let seed = 0; seed < 20; seed++) for (const e of createTournament(cup, seed, "Haru").rounds[0]) assert.ok(e.name.length <= 6, e.name);
  assert.equal(roundName(8), "Quarterfinal");
  assert.equal(roundName(4), "Semifinal");
  assert.equal(roundName(2), "Final");
});
