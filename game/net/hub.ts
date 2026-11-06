import { playerColors } from "../characters.ts";
import { DEFAULT_INSIGNIA } from "../insignia.ts";
import { DEFAULT_CHARACTER } from "../characters.ts";
import type { RunState } from "../run-state.ts";
import type { SaveStore } from "../save.ts";
import { createAccountClient, createSaveApi, type AccountClient, type AccountRecord } from "./account-client.ts";
import { createAccountAuth, createGuestAuth, type AuthProvider } from "./auth.ts";
import type { LobbyClient } from "./lobby-client.ts";
import { identityOf, onlineAccess, readProfile, withResult, writeProfile, type OnlineProfile, type ProfileStore } from "./profile.ts";
import type { Identity } from "./protocol.ts";
import { createSaveSync, type SaveChoice, type SaveSync } from "./save-sync.ts";
import { createOnlineService, type FoundMatch, type OnlineService, type TournamentSession } from "./service.ts";

const ACCOUNT_RETRY_MS = 30_000;
/** Signed out with no connection, so the server still has to be told before anything else. */
const SIGN_OUT_KEY = "tiny-kendo-sign-out";

/** What needs a real form over the game right now. */
export type AccountUi =
  | { kind: "form"; submit(mode: "sign-in" | "sign-up", username: string, password: string): Promise<string | null>; cancel(): void }
  | { kind: "choice"; choice: SaveChoice }
  | { kind: "sign-out"; confirm(): void; cancel(): void };
export type LobbyIntent = { kind: "create" } | { kind: "type-code" } | { kind: "join"; code: string } | { kind: "return" };

/** Everything the multiplayer screens share, kept out of the story's state entirely. */
export type OnlineHub = {
  readonly service: OnlineService;
  profile(): OnlineProfile;
  identity(): Identity;
  access(): ReturnType<typeof onlineAccess>;
  finishTutorial(): void;
  recordResult(won: boolean): void;
  /** Your record: the account's if you're signed in, and this browser's if not. */
  record(): AccountRecord;
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
  /** The account behind this, if there's a server to have one on. */
  readonly account: AccountClient | null;
  /** The story's connection to the account, if there's one to keep. */
  readonly save: SaveSync | null;
  /** A lobby code from the address, on its way through signing in and the tutorial. */
  invite: string | null;
  /** The invite's already been through the tutorial once, so it won't send them round again. */
  inviteTutorialTried: boolean;
  lobby: LobbyClient | null;
  lobbyIntent: LobbyIntent;
  accountUi(): AccountUi | null;
  openAccountForm(): void;
  signOut(): void;
  /** Whether your story's been matched up with the account yet, so that your rank can be trusted. */
  storySettled(): boolean;
};

export function createOnlineHub(options: {
  store: (ProfileStore & Partial<SaveStore>) | null;
  readRun(): RunState | null;
  serverUrl?: string;
  invite?: string | null;
  fetcher?: typeof fetch;
  auth?: (identity: () => Identity) => AuthProvider;
  /** Someone's arrived in your lobby. */
  alert?(): void;
  inStory?(): boolean;
  /** The story's changed underneath the game, or gone. */
  reloadRun?(run: RunState | null): void;
  schedule?(run: () => void, ms: number): void;
}): OnlineHub {
  const { store, readRun, serverUrl } = options;
  const schedule = options.schedule ?? ((run: () => void, ms: number) => void setTimeout(run, ms));
  let profile = readProfile(store);
  writeProfile(store, profile);
  const update = (next: OnlineProfile) => {
    profile = next;
    writeProfile(store, profile);
  };
  const fetcher = options.fetcher ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const account = serverUrl ? createAccountClient(fetcher) : null;
  const save =
    account && store?.removeItem
      ? createSaveSync({
          store: store as SaveStore,
          api: createSaveApi(fetcher),
          now: Date.now,
          inStory: options.inStory ?? (() => false),
          reload: (run) => options.reloadRun?.(run),
          schedule,
        })
      : null;
  const guest = () => identityOf(profile, readRun());
  const auth = options.auth ? options.auth(guest) : account ? createAccountAuth(account.current, guest) : createGuestAuth(guest);
  const identity = () => auth.identity();
  let formOpen = false;
  let signOutWarning = false;

  /** Whoever you turn out to be, your story and what you've already done get matched up with the account. */
  const welcome = () => {
    const signedIn = account?.current();
    if (!signedIn) return;
    if (profile.tutorial && !signedIn.tutorial) void account!.finishTutorial();
    void save?.signedIn(signedIn.id);
  };
  const owedSignOut = () => {
    try {
      return store?.getItem(SIGN_OUT_KEY) === "1";
    } catch {
      return false;
    }
  };
  const owesSignOut = (owes: boolean) => {
    try {
      if (owes) store?.setItem(SIGN_OUT_KEY, "1");
      else store?.removeItem?.(SIGN_OUT_KEY);
    } catch {
      // Nothing more can be done.
    }
  };
  const checkAccount = async () => {
    if (owedSignOut()) {
      // The cookie would sign the last person straight back in, on what may be a shared computer.
      if (await account!.signOut()) owesSignOut(false);
      else schedule(() => void checkAccount(), ACCOUNT_RETRY_MS);
      return;
    }
    await account!.refresh();
    if (account!.status() === "signed-in") welcome();
    // A server that can't be reached might only be waking up.
    else if (account!.status() === "unreachable") schedule(() => void checkAccount(), ACCOUNT_RETRY_MS);
  };
  if (account) void checkAccount();

  const finishSigningOut = async (force: boolean) => {
    if (!save) {
      owesSignOut(!(await account!.signOut()));
      return;
    }
    const { sent } = await save.signOut({ force });
    if (!sent && !force) {
      signOutWarning = true;
      return;
    }
    owesSignOut(!(await account!.signOut()));
    profile = readProfile(store);
    writeProfile(store, profile);
    options.reloadRun?.(null);
  };

  return {
    service: createOnlineService(auth, serverUrl, { alert: options.alert }),
    profile: () => profile,
    identity,
    access: () => onlineAccess({ ...profile, tutorial: profile.tutorial || !!account?.current()?.tutorial }, readRun()),
    finishTutorial() {
      update({ ...profile, tutorial: true });
      void account?.finishTutorial();
    },
    recordResult: (won) => update(withResult(profile, won)),
    record: () => account?.record() ?? { wins: profile.wins, losses: profile.losses },
    look() {
      const run = readRun();
      return playerColors(run?.gi ? run : { character: run?.character ?? DEFAULT_CHARACTER, insignia: run?.insignia ?? DEFAULT_INSIGNIA, gi: true });
    },
    match: null,
    tournament: null,
    lastWon: null,
    returnTo: "title",
    account,
    save,
    invite: options.invite ?? null,
    inviteTutorialTried: false,
    lobby: null,
    lobbyIntent: { kind: "create" },
    accountUi() {
      const choice = save?.pendingChoice();
      if (choice) return { kind: "choice", choice };
      if (signOutWarning) {
        return {
          kind: "sign-out",
          confirm() {
            signOutWarning = false;
            void finishSigningOut(true);
          },
          cancel() {
            signOutWarning = false;
          },
        };
      }
      if (!formOpen) return null;
      return {
        kind: "form",
        async submit(mode, username, password) {
          const problem = await (mode === "sign-up" ? account!.signUp(username, password) : account!.signIn(username, password));
          if (!problem) {
            formOpen = false;
            owesSignOut(false);
            welcome();
          }
          return problem;
        },
        cancel() {
          formOpen = false;
        },
      };
    },
    openAccountForm() {
      formOpen = true;
    },
    signOut() {
      void finishSigningOut(false);
    },
    storySettled: () => !save || save.settled(),
  };
}
