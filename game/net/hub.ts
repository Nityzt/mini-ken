import { playerColors } from "../characters.ts";
import { DEFAULT_INSIGNIA } from "../insignia.ts";
import { DEFAULT_CHARACTER } from "../characters.ts";
import type { RunState } from "../run-state.ts";
import { createGuestAuth, type AuthProvider } from "./auth.ts";
import { identityOf, onlineAccess, readProfile, withResult, writeProfile, type OnlineProfile, type ProfileStore } from "./profile.ts";
import type { Identity } from "./protocol.ts";
import { createOnlineService, type FoundMatch, type OnlineService, type TournamentSession } from "./service.ts";

/** Everything the multiplayer screens share, kept out of the story's state entirely. */
export type OnlineHub = {
  readonly service: OnlineService;
  profile(): OnlineProfile;
  identity(): Identity;
  access(): ReturnType<typeof onlineAccess>;
  finishTutorial(): void;
  recordResult(won: boolean): void;
  /** How you look: as yourself if you've got a story going, and in the usual kit if not. */
  look(): Record<string, string>;
  /** The match about to be played or under way. */
  match: FoundMatch | null;
  /** The tournament in progress, if this match is part of one. */
  tournament: TournamentSession | null;
  /** How the last match went, for whoever's waiting on it. */
  lastWon: boolean | null;
  /** Where Back goes. */
  returnTo: "title" | "story";
};

export function createOnlineHub(options: { store: ProfileStore | null; readRun(): RunState | null; serverUrl?: string; auth?: (identity: () => Identity) => AuthProvider }): OnlineHub {
  const { store, readRun } = options;
  let profile = readProfile(store);
  writeProfile(store, profile);
  const update = (next: OnlineProfile) => {
    profile = next;
    writeProfile(store, profile);
  };
  const identity = () => identityOf(profile, readRun());
  const auth = (options.auth ?? createGuestAuth)(identity);
  return {
    service: createOnlineService(auth, options.serverUrl),
    profile: () => profile,
    identity,
    access: () => onlineAccess(profile, readRun()),
    finishTutorial: () => update({ ...profile, tutorial: true }),
    recordResult: (won) => update(withResult(profile, won)),
    look() {
      const run = readRun();
      return playerColors(run?.gi ? run : { character: run?.character ?? DEFAULT_CHARACTER, insignia: run?.insignia ?? DEFAULT_INSIGNIA, gi: true });
    },
    match: null,
    tournament: null,
    lastWon: null,
    returnTo: "title",
  };
}
