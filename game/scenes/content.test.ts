import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, measureText, wrapText } from "../art/font.ts";
import { STAGE_W } from "../core/scale.ts";
import { GANGS } from "../world/map.ts";
import { allContentLines, CONTROL_ROWS, INSIGNIA_NOTE, GANG_STORIES, MAP_HELP, GI_LINE, MOMO_WELCOME, SENSEI_SHINAI, DAI_LINES, DIALOGUE_LINES, DIALOGUE_WIDTH, GEAR_LINES, KEI_LINES, REN_LINES, WIN_LINES } from "./content.ts";
import { KIRIKAESHI_HELP, KIRIKAESHI_SIDE, moodLine } from "./content.ts";
import { measureText as measure_ } from "../art/font.ts";
import { STAGE_W as STAGE_W_ } from "../core/scale.ts";
import { DOJOS as DOJOS_ } from "../world/dojos.ts";

test("the gear lines match the design", () => {
  assert.equal(GEAR_LINES.tare, "Tare: guards the waist and hips. It goes on first.");
  assert.equal(GEAR_LINES.do, "Do: the chest armor. The strike to its side is also called do.");
  assert.equal(GEAR_LINES.men, "Men: the helmet and face grille. Also the top-of-head target.");
  assert.equal(GEAR_LINES.kote, "Kote: padded gloves for hands and wrists.");
  assert.equal(GEAR_LINES.shinai, "Shinai: four bamboo slats tied together, on loan from Sensei. Never step over one!");
});

test("the story's lines are part of the checked content", () => {
  const all = allContentLines();
  for (const line of [...MOMO_WELCOME, ...SENSEI_SHINAI, GI_LINE]) assert.ok(all.includes(line), line);
});

test("every dialogue line can be drawn", () => {
  const lines = allContentLines();
  assert.ok(lines.length > 10);
  for (const line of lines) {
    for (const char of line) assert.ok(GLYPHS[char], `"${char}" in "${line}"`);
  }
});

test("every dialogue line fits in the box", () => {
  for (const line of allContentLines()) {
    assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
  }
});

test("no real club people appear in the content", () => {
  const real = /\b(Ian|Qihan|Matthew|Wong|Lucas|Navarro|Belal|Aboulnaga|Daniel|Woo|Julie|Saleem|Khan|Miguel|Quiban|Nityam|Goyal|Simon|Choe|Shawn|Kim|Kiyoshi|Hao|Fuminori|Toyasaki|Ryan|Prendergast|Tadashi|Wakabayashi|Valiquette|Toronto|Waterloo|York)\b/;
  for (const line of allContentLines()) assert.equal(real.exec(line), null, line);
});

test("the content doesn't advertise the club", () => {
  const pitch = /\b(register|sign up|join us|membership|tuition)\b/i;
  for (const line of allContentLines()) assert.equal(pitch.exec(line), null, line);
});

test("the rival dojo and win lines are part of the checked content", () => {
  const all = allContentLines();
  for (const line of [...KEI_LINES, ...DAI_LINES, ...REN_LINES, ...WIN_LINES]) assert.ok(all.includes(line), line);
});

test("the hints point at the rival's habits without spelling out the counters", () => {
  for (const line of [...KEI_LINES, ...DAI_LINES]) assert.equal(/\b(kote|do)\b/i.test(line), false, line);
});

test("every gang has a story: someone in trouble, and a reason to step in", () => {
  for (const gang of Object.keys(GANGS)) {
    const story = GANG_STORIES[gang];
    assert.ok(story, gang);
    assert.ok(story.person.length > 0, gang);
    assert.ok(story.help[0].startsWith(`${story.person}:`), `${gang} opens with the person in trouble`);
    assert.ok(story.help.some((line) => line.includes("Alley Cat")), `${gang} names the gang`);
    assert.ok(story.help.length <= 2, `${gang} keeps the talking short`);
  }
});

test("the thanks come from the person you saved, and say what you earned", () => {
  for (const gang of Object.keys(GANGS)) {
    const story = GANG_STORIES[gang];
    assert.ok(story.thanks.startsWith(`${story.person}:`), gang);
    assert.ok(story.thanks.includes("ki +10"), gang);
    assert.ok(story.after.startsWith(`${story.person}:`), gang);
  }
});

test("the gang stories are part of the checked content", () => {
  const all = allContentLines();
  for (const story of Object.values(GANG_STORIES)) {
    for (const line of [...story.help, story.thanks, story.after]) assert.ok(all.includes(line), line);
  }
});

test("nobody picks a fight with a stranger any more", () => {
  for (const line of allContentLines()) assert.equal(/pick a fight/i.test(line), false, line);
});

test("every map prompt fits on one line", () => {
  for (const line of Object.values(MAP_HELP)) assert.ok(measureText(line) <= STAGE_W - 4, line);
});

test("Ren's dojo warns you about being pressed behind your guard", () => {
  assert.ok(KEI_LINES.some((line) => line.includes("guard")));
});

test("the controls page fits on the screen", () => {
  assert.ok(CONTROL_ROWS.length * 10 + 20 < 132);
  for (const row of CONTROL_ROWS) {
    assert.ok(measureText(row.keys) <= 96, row.keys);
    assert.ok(114 + measureText(row.does) <= STAGE_W, row.does);
  }
});

test("the insignia screen's text fits, and its arrows can be drawn", () => {
  assert.ok(measureText(INSIGNIA_NOTE) <= STAGE_W - 8, INSIGNIA_NOTE);
  assert.ok(GLYPHS["<"] && GLYPHS[">"]);
});

test("anyone's mood fits on the bow screen", () => {
  for (const name of [...Object.values(DOJOS_).map((dojo) => `Sensei ${dojo.sensei.name}`), "Tetsu", "Goro"]) {
    for (const pace of ["quick", "calm", "slow"] as const) {
      for (const favourite of ["men", "kote", "do", "bigMen"] as const) assert.ok(measure_(moodLine(name, pace, favourite)) <= STAGE_W_ - 8, moodLine(name, pace, favourite));
    }
  }
});

test("kirikaeshi's help, a line at a time, fits along the bottom at the smallest size", () => {
  for (const line of Object.values(KIRIKAESHI_HELP)) assert.ok(measureText(line) <= STAGE_W - 4, line);
  for (const side of Object.values(KIRIKAESHI_SIDE)) assert.ok(measureText(`A ${side}`) <= STAGE_W / 3, side);
});

test("the Grand Taikai ending is Ren, then Sensei, says where the badge is, and every line fits", async () => {
  const { TAIKAI_ENDING } = await import("./content.ts");
  assert.deepEqual([...new Set(TAIKAI_ENDING.map((line) => line.split(":")[0]))], ["Ren", "Sensei Kuma"]);
  assert.match(TAIKAI_ENDING.join(" "), /Progress page/);
  for (const line of TAIKAI_ENDING) assert.ok(wrapText(line, DIALOGUE_WIDTH).length <= DIALOGUE_LINES, line);
});
