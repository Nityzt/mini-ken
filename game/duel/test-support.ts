import { createDuel, type DuelOptions, type DuelState } from "./rules.ts";

/** A match where strikes need no opening, for testing the mechanics that have nothing to do with openings. */
export const directDuel = (options: DuelOptions = {}): DuelState => createDuel({ direct: [true, true], ...options });
