import { CHARACTERS } from "../characters.ts";
import { stepInsigniaEditor, type InsigniaRow } from "../insignia.ts";
import { allowedAppearance, canWearOnline, ONLINE_ARMOR, type Appearance, type OnlineRecord } from "./appearance.ts";

export type Editor = { appearance: Appearance; row: number };
export type EditorKeys = { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; cancel: boolean };
export const createAppearanceEditor = (appearance: Appearance): Editor => ({ appearance, row: 0 });

export function stepAppearanceEditor(editor: Editor, keys: EditorKeys, record: OnlineRecord): { editor: Editor; done: "save" | "cancel" | null } {
  if (keys.cancel) return { editor, done: "cancel" };
  if (keys.confirm) return { editor, done: "save" };
  const row = (editor.row + (keys.down ? 1 : 0) - (keys.up ? 1 : 0) + 5) % 5;
  const by = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let appearance = editor.appearance;
  if (by && row === 0) {
    const index = CHARACTERS.findIndex((c) => c.id === appearance.character);
    appearance = { ...appearance, character: CHARACTERS[(index + by + CHARACTERS.length) % CHARACTERS.length].id };
  } else if (by && row === 1) {
    let index = ONLINE_ARMOR.indexOf(appearance.armor);
    do index = (index + by + ONLINE_ARMOR.length) % ONLINE_ARMOR.length;
    while (!canWearOnline(ONLINE_ARMOR[index], record));
    appearance = { ...appearance, armor: ONLINE_ARMOR[index] };
  } else if (by && row >= 2) {
    const next = stepInsigniaEditor({ insignia: appearance.insignia, row: (row - 2) as InsigniaRow }, { ...keys, up: false, down: false });
    appearance = { ...appearance, insignia: next.editor.insignia };
  }
  return { editor: { appearance, row }, done: null };
}
export const initialEditorAppearance = (appearance: Appearance, record: OnlineRecord | null): Appearance => record ? allowedAppearance(appearance, record) : appearance;
