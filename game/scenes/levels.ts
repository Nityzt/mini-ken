// Legend: # roof, W wall, w window, D front door, r rack, . floor, @ start, M Momo, X Sensei,
// A, B and Y the other senpai, Z Nao at the door, N the notice board, Q storage door, G the spare gi, C cracked bamboo screen, U lucky tsuba, V whoever's visiting,
// s someone doing suburi, k someone in keiko, $ the merch table.
export const CLUB_SOLID = "#WwDrpMXABYZCQNVsk$";

export const CLUB_MAP = [
  "##################",
  "#WwWNWWWDWWWWWwWr#",
  "#.$...Z.@........#",
  "#...........X..s.#",
  "#..............s.#",
  "#..M.......A...s.#",
  "#.Y..........B.s.#",
  "#........kk......#",
  "####Q#############",
  "##.......#########",
  "##..G....C.U.#####",
  "##.......#########",
  "##################",
];

/** The hall, down to and including the wall with the storage door. */
export const CLUB_HALL_ROWS = 9;

/** Where Momo stands to guard the cracked screen: right in front of it. */
const MOMO_GUARD_ROW = 10;
const MOMO_GUARD_COL = 8;

/** Where a visitor stands: in plain sight of the door, in nobody's way, and not right under Nao. */
const VISITOR_ROW = 3;
const VISITOR_COL = 4;

/** The club as it stands: o is the unlocked storage door. */
export function clubRows(state: { storageOpen: boolean; screenBroken: boolean; momoGuards: boolean; visitor?: boolean }): string[] {
  return CLUB_MAP.map((row, y) => {
    let next = row;
    if (state.storageOpen) next = next.replace("Q", "o");
    if (state.screenBroken) next = next.replace("C", ".");
    if (state.momoGuards) {
      next = next.replace("M", ".");
      if (y === MOMO_GUARD_ROW) next = next.slice(0, MOMO_GUARD_COL) + "M" + next.slice(MOMO_GUARD_COL + 1);
    }
    if (state.visitor && y === VISITOR_ROW) next = next.slice(0, VISITOR_COL) + "V" + next.slice(VISITOR_COL + 1);
    return next;
  });
}

export function findTiles(rows: string[], char: string): { col: number; row: number }[] {
  const found: { col: number; row: number }[] = [];
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) if (line[col] === char) found.push({ col, row });
  });
  return found;
}

// Rival dojo legend: same room tiles as the club, plus R the rival, G and E two helpers, N the notice board, V a visitor, D the way back out,
// X the dojo's sensei, under the crest, J someone who fights in a stance of their own, s someone doing suburi, k someone in keiko, and $ the merch table.
// I is Thunder Radish's low iron door, which only Raiko's key opens (owner, 2026-11-11).
export const RIVAL_SOLID = "#WwDrpXRGENVJsk$I";

export const RIVAL_MAP = [
  "################",
  "#WwWNWWrWWWIwWW#",
  "#$......X......#",
  "#......R......s#",
  "#.............s#",
  "#..G........E.s#",
  "#.............s#",
  "#.kk...@.......#",
  "#######D########",
];

export const RACCOON_MAP = [
  "################",
  "#WwWNpWWrWWpWwW#",
  "#$.....X.......#",
  "#.....R.......s#",
  "#...........E.s#",
  "#..G..........s#",
  "#.........kk...#",
  "#......@.......#",
  "#######D########",
];

export const HERON_MAP = [
  "################",
  "#WrWNWWwwWWWWrW#",
  "#$....X........#",
  "#..E........G.s#",
  "#.............s#",
  "#......R......s#",
  "#.kk.......J..s#",
  "#......@.......#",
  "#######D########",
];

export const OTTER_MAP = [
  "################",
  "#WwWpNWWWWWpWwW#",
  "#$.....X...kk..#",
  "#.........G...s#",
  "#..R..........s#",
  "#.............s#",
  "#.........E...s#",
  "#......@.......#",
  "#######D########",
];

export const GOOSE_MAP = [
  "################",
  "#WpWNwWWrWWwWpW#",
  "#$.....X.......#",
  "#..G..........s#",
  "#.........R...s#",
  "#.............s#",
  "#.kk..E....J..s#",
  "#......@.......#",
  "#######D########",
];

// Optional neighborhood dojos have no cup noticeboard.
export const LANTERN_MAP = [
  "################", "#WwWWWWrWWWWwWW#", "#$.....X.......#", "#...G.......E.s#", "#......R......s#", "#.............s#", "#.kk..........s#", "#......@.......#", "#######D########",
];
export const BAMBOO_MAP = [
  "################", "#WpWWwWWWWwWWpW#", "#$.....X.......#", "#...G.........s#", "#...........E.s#", "#......R......s#", "#.........kk..s#", "#......@.......#", "#######D########",
];

// The grading hall: P the three examiners at the far end, with candidates warming up along the wall, and D the way out.
export const HALL_SOLID = "#WwDrpPsk";

export const HALL_MAP = [
  "################",
  "#WwWWrWWWWrWWwW#",
  "#.....PPP......#",
  "#..............#",
  "#s.............#",
  "#s.............#",
  "#s.........kk..#",
  "#......@.......#",
  "#######D########",
];
