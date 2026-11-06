import { isOpen } from "../progress.ts";
import type { RunState } from "../run-state.ts";
import { cleanName, type Identity } from "./protocol.ts";

export const PROFILE_KEY = "tiny-kendo-online";
const PROFILE_VERSION = 1;
/** Everyone who's taken the short tutorial plays at this rank, since it's the lowest multiplayer has. */
export const ONLINE_MIN_DAN = 1;
const GUEST_SPREAD = 9000;

/**
 * Kept apart from the story save, so someone going straight to multiplayer never starts a story by accident,
 * and nothing here can ever change a story.
 */
export type OnlineProfile = { id: string; name: string; tutorial: boolean; wins: number; losses: number };
export type ProfileStore = Pick<Storage, "getItem" | "setItem">;

export function createProfile(roll: () => number = Math.random): OnlineProfile {
  const tag = 1000 + Math.floor(roll() * GUEST_SPREAD);
  return { id: `guest-${tag}-${Math.floor(roll() * 2 ** 31).toString(36)}`, name: `Guest ${tag}`, tutorial: false, wins: 0, losses: 0 };
}

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

export function readProfile(store: ProfileStore | null, roll?: () => number): OnlineProfile {
  try {
    const text = store?.getItem(PROFILE_KEY);
    if (text) {
      const saved = JSON.parse(text) as Record<string, unknown>;
      const p = saved?.profile as Record<string, unknown> | undefined;
      if (saved?.version === PROFILE_VERSION && p && typeof p.id === "string" && typeof p.tutorial === "boolean" && isCount(p.wins) && isCount(p.losses)) {
        return { id: p.id, name: cleanName(p.name), tutorial: p.tutorial, wins: p.wins, losses: p.losses };
      }
    }
  } catch {
    // A new one's as good.
  }
  return createProfile(roll);
}

export function writeProfile(store: ProfileStore | null, profile: OnlineProfile): void {
  try {
    store?.setItem(PROFILE_KEY, JSON.stringify({ version: PROFILE_VERSION, profile }));
  } catch {
    // It just won't be remembered.
  }
}

/** Multiplayer's for 1st dan and up: earned in the story, or by taking the short tutorial instead. */
export function onlineAccess(profile: OnlineProfile, run: RunState | null): { open: boolean; via: "story" | "tutorial" | null } {
  if (run && isOpen(run, "online")) return { open: true, via: "story" };
  return profile.tutorial ? { open: true, via: "tutorial" } : { open: false, via: null };
}

/** Who this player is to everyone else. A rank from the story counts, if it's higher. */
export const identityOf = (profile: OnlineProfile, run: RunState | null): Identity => ({
  id: profile.id,
  name: profile.name,
  dan: Math.max(ONLINE_MIN_DAN, run && isOpen(run, "online") ? run.dan : 0),
  guest: true,
});

export const withResult = (profile: OnlineProfile, won: boolean): OnlineProfile => (won ? { ...profile, wins: profile.wins + 1 } : { ...profile, losses: profile.losses + 1 });
