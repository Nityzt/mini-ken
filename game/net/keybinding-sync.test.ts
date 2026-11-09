import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeybindingSync } from './keybinding-sync.ts';
import { DEFAULT_BINDINGS } from '../core/input.ts';

const changed = { ...DEFAULT_BINDINGS, men: ['u'] };
const storage = () => { const data = new Map<string,string>(); return { getItem: (k:string) => data.get(k) ?? null, setItem: (k:string,v:string) => { data.set(k,v); } }; };
test('guest and account bindings are isolated and account bindings reach another browser', async () => {
  let remote: unknown = null;
  const fetcher = async (_path: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') { remote = JSON.parse(String(init.body)).bindings; return new Response('{}', { status: 200 }); }
    return Response.json({ accountId: 'a', bindings: remote });
  };
  const changes: unknown[] = [];
  const sync = createKeybindingSync({ store: storage(), fetcher: fetcher as typeof fetch, onChange: (x) => changes.push(x) });
  await sync.set(changed);
  await sync.signedIn('a');
  assert.deepEqual(sync.current(), DEFAULT_BINDINGS);
  await sync.set({ ...DEFAULT_BINDINGS, men: ['v'] });
  sync.signedOut();
  assert.deepEqual(sync.current(), changed);
  const other = createKeybindingSync({ store: storage(), fetcher: fetcher as typeof fetch, onChange: () => {} });
  await other.signedIn('a');
  assert.deepEqual(other.current().men, ['v']);
});
test('late account reads cannot overwrite guest settings after signout', async () => {
  let resolve!: (r: Response) => void;
  const fetcher = () => new Promise<Response>((r) => { resolve = r; });
  const sync = createKeybindingSync({ store: storage(), fetcher: fetcher as typeof fetch, onChange: () => {} });
  await sync.set(changed);
  const wait = sync.signedIn('a');
  sync.signedOut();
  resolve(Response.json({ accountId: 'a', bindings: { ...DEFAULT_BINDINGS, men: ['v'] } }));
  await wait;
  assert.deepEqual(sync.current(), changed);
});
test('an edit while account settings are loading is not replaced by the late response', async () => {
  let resolve!: (r: Response) => void;
  const fetcher = (_path: RequestInfo | URL, init?: RequestInit) => init?.method === 'PUT'
    ? Promise.resolve(new Response('{}', { status: 200 }))
    : new Promise<Response>((r) => { resolve = r; });
  const sync = createKeybindingSync({ store: storage(), fetcher: fetcher as typeof fetch, onChange: () => {} });
  const loading = sync.signedIn('a');
  await sync.set(changed);
  resolve(Response.json({ accountId: 'a', bindings: { ...DEFAULT_BINDINGS, men: ['v'] } }));
  await loading;
  assert.deepEqual(sync.current().men, ['u']);
});
test('offline account edits are retained and retried when signing in again', async () => {
  let offline = true;
  let remote: unknown = null;
  const fetcher = async (_path: RequestInfo | URL, init?: RequestInit) => {
    if (offline) throw new Error('offline');
    if (init?.method === 'PUT') { remote = JSON.parse(String(init.body)).bindings; return new Response('{}', { status: 200 }); }
    return Response.json({ accountId: 'a', bindings: remote });
  };
  const store = storage();
  const sync = createKeybindingSync({ store, fetcher: fetcher as typeof fetch, onChange: () => {} });
  await sync.signedIn('a');
  await sync.set(changed);
  sync.signedOut();
  offline = false;
  await sync.signedIn('a');
  assert.deepEqual(remote, changed);
  assert.deepEqual(sync.current(), changed);
});
test('account changes can still reach the server when browser storage is unavailable', async () => {
  let remote: unknown = null;
  const fetcher = async (_path: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') { remote = JSON.parse(String(init.body)).bindings; return new Response('{}'); }
    return Response.json({ accountId: 'a', bindings: null });
  };
  const sync = createKeybindingSync({ store: null, fetcher: fetcher as typeof fetch, onChange: () => {} });
  await sync.signedIn('a');
  await sync.set(changed);
  assert.deepEqual(remote, changed);
});

test('a failed account update reports unsaved and retries on reconnect', async () => {
  let online = false;
  let remote: unknown = null;
  const fetcher = async (_path: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      if (!online) throw new Error('offline');
      remote = JSON.parse(String(init.body)).bindings;
      return new Response('{}');
    }
    return Response.json({ accountId: 'a', bindings: null });
  };
  const sync = createKeybindingSync({ store: storage(), fetcher: fetcher as typeof fetch, onChange: () => {} });
  await sync.signedIn('a');
  assert.equal(await sync.set(changed), false);
  online = true;
  await sync.retry();
  assert.deepEqual(remote, changed);
});
