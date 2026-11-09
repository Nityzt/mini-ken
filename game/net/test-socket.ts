import type { SocketLike } from "./transport.ts";

/** A socket for tests, which only does what it's told. */
export function fakeSocket() {
  const sent: string[] = [];
  const socket: SocketLike & { sent: string[]; arrive(m: unknown): void; opened(): void; drop(): void } = {
    readyState: 0,
    sent,
    send: (text: string) => void sent.push(text),
    close() {
      this.onclose?.({} as never);
    },
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    arrive(m: unknown) {
      this.onmessage?.({ data: typeof m === "string" ? m : JSON.stringify(m) });
    },
    opened() {
      (this as { readyState: number }).readyState = 1;
      this.onopen?.({} as never);
    },
    drop() {
      this.onclose?.({} as never);
    },
  };
  return socket;
}
