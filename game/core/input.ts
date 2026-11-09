export type Action =
  | "left" | "right" | "up" | "down"
  | "men" | "kote" | "do"
  | "raise" | "wrist" | "drop"
  | "stomp" | "seme" | "confirm" | "cancel" | "pause" | "mute" | "copy" | "fullscreen";

export type Bindings = Record<Action, string[]>;

export type Input = {
  isDown(action: Action): boolean;
  wasPressed(action: Action): boolean;
  /** Whether keys are text right now, instead of controls. */
  readonly typing: boolean;
  setTyping(on: boolean): void;
  /** What was typed this tick, in order: single characters, or "Backspace", "Enter" or "Escape". */
  typed(): readonly string[];
  endTick(): void;
  clear(): void;
  dispose(): void;
};

export const DEFAULT_KEY_ACTIONS: Record<string, Action[]> = {
  arrowleft: ["left"],
  a: ["left"],
  arrowright: ["right"],
  d: ["right"],
  arrowup: ["up"],
  w: ["up", "raise"],
  q: ["wrist"],
  arrowdown: ["down"],
  s: ["down"],
  j: ["men"],
  k: ["kote"],
  l: ["do"],
  i: ["seme"],
  " ": ["stomp", "confirm"],
  e: ["confirm", "drop"],
  c: ["copy"],
  enter: ["confirm"],
  x: ["cancel"],
  escape: ["pause"],
  p: ["pause"],
  m: ["mute"],
  f: ["fullscreen"],
};

export const DEFAULT_BINDINGS: Bindings = Object.fromEntries(
  (["left", "right", "up", "down", "men", "kote", "do", "raise", "wrist", "drop", "stomp", "seme", "confirm", "cancel", "pause", "mute", "copy", "fullscreen"] as Action[]).map(
    (action) => [action, Object.entries(DEFAULT_KEY_ACTIONS).filter(([, actions]) => actions.includes(action)).map(([key]) => key)],
  ),
) as Bindings;

/**
 * The map key for a press. The printed letter comes first, so Latin layouts match what the
 * on-screen prompts say. Non-Latin layouts and active IMEs fall back to the key's position.
 */
function resolveKey(key: string, code: string | undefined, actions: Record<string, Action[]> = DEFAULT_KEY_ACTIONS): string | null {
  const lower = key.toLowerCase();
  if (lower in actions) return lower;
  if (/^[\x20-\x7e]$/.test(lower)) return null;
  const letter = code?.match(/^Key([A-Z])$/)?.[1].toLowerCase();
  return letter && letter in actions ? letter : null;
}

const TEXT_KEYS = new Set(["Backspace", "Enter", "Escape"]);
const ACTIVATING_KEYS = new Set(["enter", " "]);
const ACTIVATABLE_TAGS = new Set(["A", "BUTTON"]);
/** Whatever's in one of these belongs to the form it's on, not the game. */
const FORM_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function shouldCaptureKey(e: {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  targetTag: string | null;
}, actions: Record<string, Action[]> = DEFAULT_KEY_ACTIONS): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const key = resolveKey(e.key, e.code, actions);
  if (!key) return false;
  // A focused link or button keeps Enter and Space, so keyboard users can follow it.
  if (e.targetTag && ACTIVATABLE_TAGS.has(e.targetTag) && ACTIVATING_KEYS.has(key)) return false;
  return true;
}

type KeyEventLike = Event & { key: string; code?: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

export function createInput(target: EventTarget): Input & { bindings(): Bindings; setBindings(bindings: Bindings): void; matches(action: Action, key: string, code?: string): boolean } {
  let current = structuredClone(DEFAULT_BINDINGS);
  let keyActions: Record<string, Action[]> = structuredClone(DEFAULT_KEY_ACTIONS);
  // Held keys are tracked by position, because a key's character can change before it's released.
  const held = new Map<string, Action[]>();
  const pressed = new Set<Action>();
  const typedKeys: string[] = [];
  let typing = false;

  const onTyped = (e: KeyEventLike) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1 && !TEXT_KEYS.has(e.key)) return;
    e.preventDefault();
    // A held letter doesn't run on, so the E that opened the box can't end up in it. Holding Backspace does.
    if (!e.repeat || e.key === "Backspace") typedKeys.push(e.key);
  };
  const onKeyDown = (event: Event) => {
    const e = event as KeyEventLike;
    const tag = (e.target as { tagName?: string } | null)?.tagName ?? null;
    if (tag && (FORM_TAGS.has(tag) || (typing && ACTIVATABLE_TAGS.has(tag)))) return;
    if (typing) {
      onTyped(e);
      return;
    }
    if (!shouldCaptureKey({ key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, targetTag: tag }, keyActions)) return;
    e.preventDefault();
    const actions = keyActions[resolveKey(e.key, e.code, keyActions)!];
    held.set(e.code || e.key.toLowerCase(), actions);
    if (!e.repeat) for (const action of actions) pressed.add(action);
  };
  const onKeyUp = (event: Event) => {
    const e = event as KeyEventLike;
    held.delete(e.code || e.key.toLowerCase());
  };
  const clear = () => {
    held.clear();
    pressed.clear();
    typedKeys.length = 0;
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", clear);

  return {
    bindings: () => structuredClone(current),
    matches: (action, key, code) => keyActions[resolveKey(key, code, keyActions) ?? ""]?.includes(action) ?? false,
    setBindings(bindings) {
      current = structuredClone(bindings);
      keyActions = {};
      for (const [action, keys] of Object.entries(current) as [Action, string[]][]) {
        for (const key of keys) (keyActions[key] ??= []).push(action);
      }
      clear();
    },
    isDown(action) {
      for (const actions of held.values()) if (actions.includes(action)) return true;
      return false;
    },
    wasPressed: (action) => pressed.has(action),
    get typing() {
      return typing;
    },
    setTyping(on) {
      if (on === typing) return;
      typing = on;
      clear();
    },
    typed: () => typedKeys,
    endTick() {
      pressed.clear();
      typedKeys.length = 0;
    },
    clear,
    dispose() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", clear);
      clear();
    },
  };
}
