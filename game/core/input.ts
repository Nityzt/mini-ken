export type Action =
  | "left" | "right" | "up" | "down"
  | "men" | "kote" | "do"
  | "stomp" | "seme" | "confirm" | "cancel" | "pause" | "mute";

export type Input = {
  isDown(action: Action): boolean;
  wasPressed(action: Action): boolean;
  endTick(): void;
  clear(): void;
  dispose(): void;
};

const KEY_ACTIONS: Record<string, Action[]> = {
  arrowleft: ["left"],
  a: ["left"],
  arrowright: ["right"],
  d: ["right"],
  arrowup: ["up"],
  w: ["up"],
  arrowdown: ["down"],
  s: ["down"],
  j: ["men"],
  k: ["kote"],
  l: ["do"],
  i: ["seme"],
  " ": ["stomp", "confirm"],
  e: ["confirm"],
  enter: ["confirm"],
  x: ["cancel"],
  escape: ["pause"],
  p: ["pause"],
  m: ["mute"],
};

/**
 * The map key for a press. The printed letter comes first, so Latin layouts match what the
 * on-screen prompts say. Non-Latin layouts and active IMEs fall back to the key's position.
 */
function resolveKey(key: string, code: string | undefined): string | null {
  const lower = key.toLowerCase();
  if (lower in KEY_ACTIONS) return lower;
  const letter = code?.match(/^Key([A-Z])$/)?.[1].toLowerCase();
  return letter && letter in KEY_ACTIONS ? letter : null;
}

const ACTIVATING_KEYS = new Set(["enter", " "]);
const ACTIVATABLE_TAGS = new Set(["A", "BUTTON"]);

export function shouldCaptureKey(e: {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  targetTag: string | null;
}): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const key = resolveKey(e.key, e.code);
  if (!key) return false;
  // A focused link or button keeps Enter and Space, so keyboard users can follow it.
  if (e.targetTag && ACTIVATABLE_TAGS.has(e.targetTag) && ACTIVATING_KEYS.has(key)) return false;
  return true;
}

type KeyEventLike = Event & { key: string; code?: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

export function createInput(target: EventTarget): Input {
  // Held keys are tracked by position, because a key's character can change before it's released.
  const held = new Map<string, Action[]>();
  const pressed = new Set<Action>();

  const onKeyDown = (event: Event) => {
    const e = event as KeyEventLike;
    const tag = (e.target as { tagName?: string } | null)?.tagName ?? null;
    if (!shouldCaptureKey({ key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, targetTag: tag })) return;
    e.preventDefault();
    const actions = KEY_ACTIONS[resolveKey(e.key, e.code)!];
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
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", clear);

  return {
    isDown(action) {
      for (const actions of held.values()) if (actions.includes(action)) return true;
      return false;
    },
    wasPressed: (action) => pressed.has(action),
    endTick: () => pressed.clear(),
    clear,
    dispose() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", clear);
      clear();
    },
  };
}
