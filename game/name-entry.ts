import { cleanPlayerName, NAME_LIMIT } from "./characters.ts";

/** Typing a name. Empty text means you'll go by `fallback`. */
export type NameEntry = { text: string; fallback: string; tick: number };

export const createNameEntry = (fallback: string, current = ""): NameEntry => ({ text: current, fallback, tick: 0 });

/** Takes what's been typed this tick. Enter keeps the name, and Escape leaves things as they were. */
export function stepNameEntry(entry: NameEntry, typed: readonly string[]): { entry: NameEntry; done: "keep" | "back" | null } {
  let { text } = entry;
  for (const key of typed) {
    if (key === "Enter") return { entry: { ...entry, text }, done: "keep" };
    if (key === "Escape") return { entry: { ...entry, text }, done: "back" };
    if (key === "Backspace") text = text.slice(0, -1);
    else if (key.length === 1 && text.length < NAME_LIMIT && (key === " " ? text.length > 0 && !text.endsWith(" ") : cleanPlayerName(key))) text += key;
  }
  return { entry: { ...entry, text, tick: entry.tick + 1 }, done: null };
}
