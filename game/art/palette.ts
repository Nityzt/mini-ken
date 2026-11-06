/** One-character palette keys, so sprites can be drawn as text. "." is transparent. */
export const PALETTE: Record<string, string> = {
  K: "#1A1A1A", // ink, site dark
  k: "#3A3A42", // soft ink
  W: "#FAF7F2", // gi, site cream
  w: "#D6CEC4", // shaded cream
  R: "#E8192C", // club red
  r: "#9E1421", // dark red
  I: "#2B3A67", // indigo armor
  i: "#4A5F9E", // armor highlight
  N: "#171F3D", // deep indigo
  S: "#F6CFA8", // skin
  s: "#D9A277", // skin shadow
  P: "#F09A8E", // blush
  B: "#A8743F", // wood
  b: "#6B4526", // dark wood
  D: "#966233", // mid wood
  L: "#C9985C", // sunlit wood
  O: "#EFE6D4", // paper screen
  Y: "#E6C46A", // bamboo
  y: "#B8923A", // bamboo shadow
  G: "#6FA85B", // grass
  g: "#3E6E4A", // dark grass
  C: "#9CCBE6", // sky
  H: "#1A1A1A", // hair
  h: "#3A3A42", // hair highlight
  Z: "#E8192C", // the cloth on the front of a tare
  z: "#FAF7F2", // the mark on that cloth
  // The men's own details, which only the playable characters change. See `MEN_INHERITS`.
  M: "#D6CEC4", // grille
  T: "#E8192C", // cords
  t: "#9E1421", // cords, shaded
  A: "#2B3A67", // stitching on the padding
  E: "#2B3A67", // crest
  U: "#2B3A67", // throat guard
};

/** Anyone who doesn't set these looks as if the details weren't there: the grille and cords stay as they were, and the rest melts into the armor. */
export const MEN_INHERITS: Record<string, string> = { M: "w", T: "R", t: "r", A: "I", E: "I", U: "I" };

/** The interface's own colors. They're softer than the sprites' ink and cream, so reading is easy on the eyes. */
export const UI = {
  panel: "#20212A",
  edge: "#565763",
  track: "#3C3D49",
  slot: "#2B2C37",
  text: "#E9E4DA",
  dim: "#B5B0A6",
  faint: "#7F7D85",
  accent: "#E8C872",
  good: "#8CC07A",
  bad: "#EF7B76",
  keyFace: "#D9D3C8",
  keyEdge: "#9F9A91",
};

/** Colors for the rival's armor, swapped in over the player's indigo. */
export const RIVAL_COLORS: Record<string, string> = {
  I: "#5E1F2E",
  i: "#8A3346",
  N: "#2C1117",
};

/** Colors for Hana of Angry Goose Dojo, in goose-grey armor with an orange trim. */
export const GOOSE_COLORS: Record<string, string> = {
  I: "#59636B",
  i: "#E08A2E",
  N: "#2B3136",
};

/** Colors for Sensei, in teal armor, with grey hair and lines. */
export const SENIOR_COLORS: Record<string, string> = {
  I: "#2F6B62",
  i: "#4C9A8C",
  N: "#173B36",
  K: "#6E6A66",
};

/** Colors for Momo, the friendly senpai. */
export const MOMO_COLORS: Record<string, string> = {
  I: "#8E4A6B",
  i: "#B56B8E",
  N: "#4E2A41",
  K: "#3A2233",
};

/** What everyone at home wears: your own dojo's green. */
export const PINECONE_COLORS: Record<string, string> = { I: "#3F5C3A", i: "#6F9A62", N: "#22331F" };
/** The other senpai at home, each in their own armor. */
export const RACCOON_COLORS: Record<string, string> = { I: "#6E6A72", i: "#96929A", N: "#37343B" };
export const HERON_COLORS: Record<string, string> = { I: "#49707F", i: "#6F9AAB", N: "#233840" };
export const OTTER_COLORS: Record<string, string> = { I: "#7B5A3A", i: "#A67F55", N: "#3D2C1D" };
export const AKI_COLORS: Record<string, string> = { I: "#C2702E", i: "#E59A3C", N: "#6B3D1A" };
/** Bo, the wall, in stone. */
export const BO_COLORS: Record<string, string> = { I: "#6F6B5C", i: "#9A9582", N: "#37352D" };
export const YUI_COLORS: Record<string, string> = { I: "#4C4C8A", i: "#7474B8", N: "#26264A" };
export const NAO_COLORS: Record<string, string> = { I: "#7A3F6B", i: "#A8609A", N: "#3D1F36" };
export const RIKU_COLORS: Record<string, string> = { I: "#2F6E78", i: "#4E9CA8", N: "#173A40" };
/** The candidates you're paired with at a grading. */
export const ASA_COLORS: Record<string, string> = { I: "#5A6B4A", i: "#7F9468", N: "#2D3625" };
export const UME_COLORS: Record<string, string> = { I: "#6B4A5A", i: "#94687F", N: "#36252D" };
export const GORO_COLORS: Record<string, string> = { I: "#3A4A6B", i: "#5A6F94", N: "#1D2536" };
/** Candidates warming up at the grading hall, from all over. */
export const HALL_CROWD_COLORS: Record<string, string>[] = [ASA_COLORS, UME_COLORS, GORO_COLORS, { I: "#6E6A72", i: "#96929A", N: "#37343B" }, { I: "#7B5A3A", i: "#A67F55", N: "#3D2C1D" }];
/** A grading examiner, in the navy blazer judges wear, with grey hair. */
export const EXAMINER_COLORS: Record<string, string> = { W: "#2B3A67", w: "#171F3D", I: "#2B3A67", i: "#4A5F9E", N: "#3A3A42", H: "#B8B4AE", h: "#D6CEC4" };
/** Tetsu of Angry Goose Dojo, who fights in jodan, and Shin of Iron Heron Dojo, who fights with two swords. */
export const TETSU_COLORS: Record<string, string> = { I: "#9E3B2E", i: "#C96A3C", N: "#4F1E17" };
export const SHIN_COLORS: Record<string, string> = { I: "#33414A", i: "#7E93A0", N: "#1A2228" };
/** Old Gen, the hermit, in faded armor with white hair. */
export const GEN_COLORS: Record<string, string> = { I: "#7A6E5E", i: "#A3977F", N: "#3F382E", K: "#D6CEC4", H: "#D6CEC4", h: "#FAF7F2" };

/** Street clothes for the bullies. */
export const BULLY_COLORS: Record<string, string>[] = [
  { W: "#C9423B", w: "#A5342F", I: "#C9423B", i: "#C9423B", N: "#3C4656" },
  { W: "#5E8C4A", w: "#4B7239", I: "#5E8C4A", i: "#5E8C4A", N: "#54442F" },
  { W: "#E0B23C", w: "#BF962E", I: "#E0B23C", i: "#E0B23C", N: "#3A3A46" },
  { W: "#8A5FA8", w: "#704A8A", I: "#8A5FA8", i: "#8A5FA8", N: "#2F3A4A" },
];

/** Everyday clothes, before the player borrows a gi. */
export const STREET_COLORS: Record<string, string> = {
  W: "#E59A3C",
  w: "#C27F2C",
  I: "#E59A3C",
  N: "#4F5D73",
};

/** Everyday clothes for the people the Alley Cats pick on, one set per gang. */
export const PERSON_COLORS: Record<string, Record<string, string>> = {
  market: { W: "#D97FA6", w: "#B8648A", I: "#D97FA6", i: "#D97FA6", N: "#5C4A6B", K: "#8C8C94" },
  bridge: { W: "#5FB7C9", w: "#4895A6", I: "#5FB7C9", i: "#5FB7C9", N: "#3A4A66" },
  wharf: { W: "#F2E2A0", w: "#CDBB7E", I: "#F2E2A0", i: "#F2E2A0", N: "#3F5C6B", K: "#C9C4BC" },
  picnic: { W: "#E7A6C0", w: "#C685A0", I: "#E7A6C0", i: "#E7A6C0", N: "#6B5A4A", K: "#E4E0D8" },
  foundry: { W: "#D98A3C", w: "#B46F2C", I: "#D98A3C", i: "#D98A3C", N: "#3A3F48", K: "#4A3524" },
  gorge: { W: "#8BD0C4", w: "#6BAEA2", I: "#8BD0C4", i: "#8BD0C4", N: "#44506B", K: "#B86A3C" },
  boardwalk: { W: "#FAF7F2", w: "#E8192C", I: "#E8192C", i: "#E8192C", N: "#E8192C" },
};
