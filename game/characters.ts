import { PINECONE_COLORS } from "./art/palette.ts";
import { INSIGNIA_COLORS, type Insignia } from "./insignia.ts";
import { LOOKS, OWN_COLORS, type ShopItemId } from "./shop.ts";

export type CharacterId = "haru" | "saki" | "tomo" | "emi" | "kai" | "jun";
export type Character = {
  id: CharacterId;
  name: string;
  blurb: string;
  /** Skin and hair, swapped in over the base sprite. */
  look: Record<string, string>;
  /** The armor they'd pick for themselves. Everyone starts in their dojo's colors, and this one's for sale at home. */
  armor: Record<string, string>;
  /** Everyday clothes, before the gi is borrowed. */
  street: Record<string, string>;
};

/** Every playable person. They differ in looks only for now, so nobody's choice makes the game harder or easier. */
export const CHARACTERS: Character[] = [
  {
    id: "haru", name: "Haru", blurb: "Came for the armor. Stayed for the shouting.",
    look: {},
    armor: { I: "#2B3A67", i: "#4A5F9E", N: "#171F3D" },
    street: { W: "#E59A3C", w: "#C27F2C", I: "#E59A3C", N: "#4F5D73" },
  },
  {
    id: "saki", name: "Saki", blurb: "Read every book on kendo. Has not yet held a shinai.",
    look: { H: "#7A3B1E", h: "#A65A32" },
    armor: { I: "#3A3A42", i: "#5E5E6B", N: "#1E1E24" },
    street: { W: "#5FB7C9", w: "#4895A6", I: "#5FB7C9", N: "#3A4A66" },
  },
  {
    id: "tomo", name: "Tomo", blurb: "Stomps so loud the neighbours have complained.",
    look: { S: "#C68F63", s: "#A5724B", P: "#B9745A" },
    armor: { I: "#2F5D50", i: "#4F8A78", N: "#173028" },
    street: { W: "#6FA85B", w: "#568A45", I: "#6FA85B", N: "#54442F" },
  },
  {
    id: "emi", name: "Emi", blurb: "Bows to everyone. Bowed to a vending machine once.",
    look: { H: "#C9A04A", h: "#E6C46A" },
    armor: { I: "#6B2F3A", i: "#96505C", N: "#38171D" },
    street: { W: "#D97FA6", w: "#B8648A", I: "#D97FA6", N: "#5C4A6B" },
  },
  {
    id: "kai", name: "Kai", blurb: "Always first to practice. Nobody knows how.",
    look: { S: "#8D5B3A", s: "#6F4529", P: "#7E4A33", H: "#2A1C14", h: "#4A3324" },
    armor: { I: "#345A8A", i: "#5A86BC", N: "#18304F" },
    street: { W: "#F2E2A0", w: "#CDBB7E", I: "#F2E2A0", N: "#3F5C6B" },
  },
  {
    id: "jun", name: "Jun", blurb: "Took up kendo at seventy. Unimpressed so far.",
    look: { H: "#BFC3CC", h: "#E4E6EB" },
    armor: { I: "#5B4A8A", i: "#8373B8", N: "#2C2447" },
    street: { W: "#8A5FA8", w: "#704A8A", I: "#8A5FA8", N: "#2F3A4A" },
  },
];

export const DEFAULT_CHARACTER: CharacterId = "haru";
export const isCharacter = (id: unknown): id is CharacterId => CHARACTERS.some((c) => c.id === id);
export const characterById = (id: string): Character => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

const cached = new Map<string, Record<string, string>>();

/** The colors the player is drawn in. Sprites are cached by this object, so the same look always returns the same one. */
export function playerColors(who: { character: CharacterId; insignia: Insignia; gi: boolean; look?: string }): Record<string, string> {
  const { character, insignia, gi, look = "" } = who;
  const key = `${character}/${insignia.cloth}/${insignia.mark}/${gi}/${look}`;
  let colors = cached.get(key);
  if (!colors) {
    const person = characterById(character);
    const armor = look === OWN_COLORS ? person.armor : { ...PINECONE_COLORS, ...LOOKS[look as ShopItemId] };
    colors = { ...person.look, ...armor, ...(gi ? {} : person.street), Z: INSIGNIA_COLORS[insignia.cloth], z: INSIGNIA_COLORS[insignia.mark] };
    cached.set(key, colors);
  }
  return colors;
}
