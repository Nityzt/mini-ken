"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { SaveSummary } from "./net/save-sync";
import type { AccountUi } from "./net/hub";
import { SAVE_CHOICE_NOTE } from "./scenes/online-lines";

const buttonClass = "cursor-pointer rounded border border-white/40 bg-white/10 px-3 py-2 text-[15px] text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60";
const fieldClass = "mt-1 block w-full rounded border border-white/40 bg-black/40 px-3 py-2 text-[16px] text-white focus-visible:outline-2 focus-visible:outline-white";

function Dialog({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-label={label} className="w-full max-w-sm rounded-md border border-white/30 bg-[#1A1A1A] p-5 text-white shadow-lg">
        {children}
      </div>
    </div>
  );
}

function AccountForm({ ui }: { ui: Extract<AccountUi, { kind: "form" }> }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") ui.cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    setProblem(await ui.submit(mode, username, password));
    setBusy(false);
  };
  const signingUp = mode === "sign-up";

  return (
    <Dialog label={signingUp ? "Create account" : "Sign in"}>
      <div className="mb-4 flex gap-2" role="group" aria-label="Sign in or create an account">
        <button type="button" aria-pressed={!signingUp} className={`${buttonClass} flex-1 ${signingUp ? "" : "bg-white/30"}`} onClick={() => setMode("sign-in")}>
          Sign in
        </button>
        <button type="button" aria-pressed={signingUp} className={`${buttonClass} flex-1 ${signingUp ? "bg-white/30" : ""}`} onClick={() => setMode("sign-up")}>
          Create account
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label className="block text-[14px]">
          Username
          <input ref={first} className={fieldClass} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={12} required value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="mt-3 block text-[14px]">
          Password
          <input className={fieldClass} name="password" type="password" autoComplete={signingUp ? "new-password" : "current-password"} minLength={signingUp ? 8 : undefined} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {signingUp && <p className="mt-3 text-[13px] text-white/70">There&apos;s no email here, so a forgotten password can only be reset by whoever runs the game.</p>}
        {problem && (
          <p role="alert" className="mt-3 text-[14px] text-[#ff9b8a]">
            {problem}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={buttonClass} onClick={ui.cancel}>
            Back
          </button>
          <button type="submit" className={buttonClass} disabled={busy}>
            {busy ? "Just a moment..." : signingUp ? "Create account" : "Sign in"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const describe = (summary: SaveSummary | null) => {
  if (!summary) return "No story";
  return `${summary.rank}, last played ${summary.lastPlayed === null ? "unknown" : new Date(summary.lastPlayed).toLocaleString()}`;
};

function SaveChoiceDialog({ ui }: { ui: Extract<AccountUi, { kind: "choice" }> }) {
  const { choice } = ui;
  const [busy, setBusy] = useState(false);
  const pick = (keep: "local" | "account") => {
    setBusy(true);
    void choice.resolve(keep);
  };
  return (
    <Dialog label="Which story to keep">
      <h2 className="text-[18px] font-bold">Which story do you want to keep?</h2>
      <p className="mt-2 text-[14px] text-white/70">{SAVE_CHOICE_NOTE}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" className={`${buttonClass} text-left`} disabled={busy} onClick={() => pick("local")}>
          <span className="block font-bold">This browser</span>
          {describe(choice.local)}
        </button>
        <button type="button" className={`${buttonClass} text-left`} disabled={busy} onClick={() => pick("account")}>
          <span className="block font-bold">Your account</span>
          {describe(choice.account)}
        </button>
      </div>
    </Dialog>
  );
}

function SignOutWarning({ ui }: { ui: Extract<AccountUi, { kind: "sign-out" }> }) {
  return (
    <Dialog label="Sign out">
      <h2 className="text-[18px] font-bold">Sign out anyway?</h2>
      <p className="mt-2 text-[14px] text-white/70">Your latest story progress couldn&apos;t reach the server. Signing out now removes it from this browser, and it will be lost.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={ui.cancel}>
          Stay signed in
        </button>
        <button type="button" className={buttonClass} onClick={ui.confirm}>
          Sign out
        </button>
      </div>
    </Dialog>
  );
}

function GuestWarning({ ui }: { ui: Extract<AccountUi, { kind: "guest" }> }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") ui.cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui]);
  return (
    <Dialog label="Play as a guest">
      <h2 className="text-[18px] font-bold">Play as a guest?</h2>
      <p className="mt-2 text-[14px] text-white/70">Your progress may be lost after this session. It&apos;s only kept in this browser, so it can&apos;t follow you to another device, and clearing your browser data or using a private window erases it.</p>
      <p className="mt-2 text-[14px] text-white/70">With an account, your story and record are saved for you. It only takes a username and a password.</p>
      <div className="mt-4 flex flex-col gap-2">
        <button ref={first} type="button" className={buttonClass} onClick={ui.signIn}>
          Sign in or create account
        </button>
        <button type="button" className={buttonClass} onClick={ui.proceed}>
          Play as guest
        </button>
        <button type="button" className={buttonClass} onClick={ui.cancel}>
          Back
        </button>
      </div>
    </Dialog>
  );
}

/** Real forms over the game, so that password managers work and a password is a real masked field. */
export function AccountOverlay({ ui }: { ui: AccountUi }) {
  if (ui.kind === "form") return <AccountForm ui={ui} />;
  if (ui.kind === "choice") return <SaveChoiceDialog key={String(ui.choice.account?.lastPlayed)} ui={ui} />;
  if (ui.kind === "guest") return <GuestWarning ui={ui} />;
  return <SignOutWarning ui={ui} />;
}
