"use client";

import { useState } from "react";
import { DEFAULT_BINDINGS, type Action, type Bindings } from "./core/input";
import { isBindings } from "./net/keybindings-data";

export type BindingsUi = { bindings: Bindings; save(bindings: Bindings): Promise<boolean>; close(): void };
const LABELS: Record<Action, string> = {
  left: "Move left", right: "Move right", up: "Move up", down: "Move down / block",
  men: "Men strike", kote: "Kote strike", do: "Do strike", raise: "Show do", wrist: "Show kote", drop: "Show men",
  stomp: "Stomp / kiai", seme: "Seme", confirm: "Talk / confirm", cancel: "Back", pause: "Pause menu", mute: "Mute", copy: "Copy invite", fullscreen: "Fullscreen",
};
const format = (keys: string[]) => keys.map((key) => key === " " ? "space" : key).join(", ");
const parse = (text: string) => text.split(",").map((key) => key.trim().toLowerCase()).map((key) => key === "space" ? " " : key);

export function BindingsOverlay({ ui }: { ui: BindingsUi }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(Object.entries(ui.bindings).map(([action, keys]) => [action, format(keys)])) as Record<Action, string>);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const next = Object.fromEntries(Object.entries(draft).map(([action, keys]) => [action, parse(keys)])) as Bindings;
    if (!isBindings(next)) { setError("Enter at least one valid key for every action. Separate keys with commas."); return; }
    setBusy(true);
    const saved = await ui.save(next);
    setBusy(false);
    if (!saved) setError("Saved in this browser, but the account could not be updated. Reconnect and save again.");
  };
  return <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
    <div role="dialog" aria-modal="true" aria-label="Customize controls" className="max-h-full w-full max-w-xl overflow-auto rounded-md border border-white/30 bg-[#1A1A1A] p-5 text-white shadow-lg">
      <h2 className="text-xl font-bold">Customize controls</h2>
      <p className="my-3 text-sm text-white/70">Enter keys separated by commas. Use space, enter, escape, or arrowleft, arrowright, arrowup and arrowdown for those keys. A key can be shared by actions.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{(Object.keys(LABELS) as Action[]).map((action) => <label key={action} className="block text-sm">{LABELS[action]}
        <input aria-label={LABELS[action]} className="mt-1 block w-full rounded border border-white/40 bg-black/40 px-2 py-1 text-white" value={draft[action]} onChange={(event) => setDraft({ ...draft, [action]: event.target.value })}/>
      </label>)}</div>
      {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-white/40 px-3 py-2" onClick={() => setDraft(Object.fromEntries(Object.entries(DEFAULT_BINDINGS).map(([action, keys]) => [action, format(keys)])) as Record<Action, string>)}>Restore defaults</button>
        <button type="button" className="rounded border border-white/40 px-3 py-2" onClick={ui.close}>Cancel</button>
        <button type="button" className="rounded border border-white/40 bg-white/20 px-3 py-2" disabled={busy} onClick={() => void save()}>Save controls</button>
      </div>
    </div>
  </div>;
}
