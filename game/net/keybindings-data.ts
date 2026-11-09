import { DEFAULT_BINDINGS, type Bindings } from '../core/input.ts';

/** Only supported, normalized single keys; modifiers and browser shortcuts are never bindings. */
export function isBindingKey(key: unknown): key is string {
  return typeof key === 'string' && (/^[\x20-\x7e]$/.test(key) && key === key.toLowerCase() && key !== ',' || ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'enter', 'escape'].includes(key));
}

export function isBindings(value: unknown): value is Bindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const actions = Object.keys(DEFAULT_BINDINGS);
  return Object.keys(record).length === actions.length && actions.every((action) => {
    const keys = record[action];
    return Array.isArray(keys) && keys.length > 0 && keys.length <= 8 && keys.every(isBindingKey) && new Set(keys).size === keys.length;
  });
}

export const validBindingKey = isBindingKey;
