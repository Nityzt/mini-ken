import { DEFAULT_BINDINGS, type Bindings } from '../core/input.ts';
import { isBindings } from './keybindings-data.ts';

const GUEST_KEY = 'tiny-kendo-keybindings-guest';
const ACCOUNT_KEY = 'tiny-kendo-keybindings-account:';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
type Cached = { bindings: Bindings; dirty: boolean };
const clone = (bindings: Bindings): Bindings => Object.fromEntries(Object.entries(bindings).map(([action, keys]) => [action, [...keys]])) as Bindings;

/** Settings are separate from story saves: guest data never leaks into an account or another guest. */
export function createKeybindingSync(options: { store: Store | null; fetcher: typeof fetch; onChange(bindings: Bindings): void }) {
  let id: string | null = null;
  let generation = 0;
  let version = 0;
  let queue: Promise<void> = Promise.resolve();
  const memory = new Map<string, Cached>();
  const key = () => id === null ? GUEST_KEY : ACCOUNT_KEY + id;
  const read = (storageKey: string): Cached | null => {
    const cached = memory.get(storageKey);
    if (cached) return cached;
    try {
      const raw = options.store?.getItem(storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as Cached;
      return isBindings(value.bindings) && typeof value.dirty === 'boolean' ? value : null;
    } catch { return null; }
  };
  const persist = (storageKey: string, cached: Cached) => {
    memory.set(storageKey, cached);
    try { options.store?.setItem(storageKey, JSON.stringify(cached)); } catch { /* Play remains possible without storage. */ }
  };
  let current = clone(read(GUEST_KEY)?.bindings ?? DEFAULT_BINDINGS);
  const publish = (bindings: Bindings) => { current = clone(bindings); options.onChange(clone(current)); };
  const upload = (owner: string, token: number) => {
    queue = queue.then(async () => {
      if (id !== owner || generation !== token) return;
      const storageKey = ACCOUNT_KEY + owner;
      const cached = read(storageKey);
      if (!cached?.dirty) return;
      const sent = JSON.stringify(cached.bindings);
      try {
        const response = await options.fetcher('/api/keybindings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountId: owner, bindings: cached.bindings }) });
        if (!response.ok) return;
        const latest = read(storageKey);
        if (latest && JSON.stringify(latest.bindings) === sent) persist(storageKey, { ...latest, dirty: false });
      } catch { /* Keep the dirty copy for the next sign-in or change. */ }
    });
    return queue;
  };
  return {
    current: () => clone(current),
    async set(bindings: Bindings) {
      if (!isBindings(bindings)) throw new TypeError('Invalid keybindings');
      version++;
      publish(bindings);
      persist(key(), { bindings: clone(bindings), dirty: id !== null });
      if (id !== null) await upload(id, generation);
      return !read(key())?.dirty;
    },
    retry() { return id === null ? Promise.resolve() : upload(id, generation); },
    async signedIn(owner: string) {
      id = owner;
      const token = ++generation;
      version++;
      const local = read(key());
      publish(local?.bindings ?? DEFAULT_BINDINGS);
      if (local?.dirty) { await upload(owner, token); return; }
      const startVersion = version;
      try {
        const response = await options.fetcher('/api/keybindings');
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (generation !== token || id !== owner || version !== startVersion || !body || typeof body !== 'object') return;
        const { accountId, bindings } = body as { accountId?: unknown; bindings?: unknown };
        if (accountId !== owner || (bindings !== null && !isBindings(bindings))) return;
        const selected = bindings === null ? DEFAULT_BINDINGS : bindings as Bindings;
        publish(selected);
        persist(key(), { bindings: clone(selected), dirty: false });
      } catch { /* Keep that account's cached settings offline. */ }
    },
    signedOut() {
      id = null;
      generation++;
      version++;
      publish(read(GUEST_KEY)?.bindings ?? DEFAULT_BINDINGS);
    },
  };
}
