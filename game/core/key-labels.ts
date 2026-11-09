import { DEFAULT_BINDINGS, type Action, type Bindings, type Input } from './input.ts';

/** Display the first key for an action, matching the key names used by the game. */
export function keyLabel(input: Input, action: Action, preferred?: string): string {
  const bindings = (input as Input & { bindings?: () => Bindings }).bindings?.() ?? DEFAULT_BINDINGS;
  const key = preferred && bindings[action].includes(preferred) ? preferred : bindings[action][0];
  return key === ' ' ? 'Space' : key.startsWith('arrow') ? key.slice(5).toUpperCase() : key.toUpperCase();
}

const KEY_ACTION: Record<string, Action> = { A: 'left', D: 'right', W: 'raise', Q: 'wrist', E: 'drop', J: 'men', K: 'kote', L: 'do', S: 'down', I: 'seme', Space: 'stomp' };
/** Teaching keycaps use a compact notation with the original key letters. */
export function teachingKeys(input: Input, keys: string): string {
  return keys.replace(/\bJKL\b/g, "J K L").replace(/\b(?:Space|[ADWQEJKLSI])\b/g, (key) => keyLabel(input, KEY_ACTION[key], key === "Space" ? " " : key.toLowerCase()));
}

/** Update explicit keyboard instructions while leaving ordinary prose and names alone. */
export function instructionText(input: Input, text: string): string {
  if (!/\b(press|hold|holding|tap|tapping|key|keys|arrow|space|block|parry|strike|open|stomp|launch|push|pull|move|walk|talk|choose|next|back|menu|fullscreen|continue)\b/i.test(text)) return text;
  const openings = /\b[WQ]\b/.test(text) || /\b(?:hold|holding|open)\s+E\b/i.test(text);
  const confirming = /\b(?:choose|continue|next|select|talk|use|back)\b/i.test(text) && !openings;
  let result = text.replace(/\b(?:A\s+D|W|Q|E|J|K|L|S|D|X|P|M|Space|Esc)\b/g, (key) => {
    if (/^A\s+D$/.test(key)) return `${keyLabel(input, 'left', 'a')} ${keyLabel(input, 'right', 'd')}`;
    const action = key === 'E' && !openings ? 'confirm' : key === 'Space' && confirming ? 'confirm' : key === 'X' ? 'cancel' : key === 'P' || key === 'Esc' ? 'pause' : key === 'M' ? 'mute' : KEY_ACTION[key];
    return keyLabel(input, action, key === 'Space' ? ' ' : key === 'Esc' ? 'escape' : key.toLowerCase());
  });
  return result.replace(/\b(hold(?:ing)?|press|tap)\s+I\b/gi, (_, verb: string) => `${verb} ${keyLabel(input, 'seme', 'i')}`);
}
