/**
 * A two-way connection, read once per game tick. The game only ever talks to one of these, so what's
 * actually underneath (a stand-in in the same page, a WebSocket, or whatever hosting ends up being) can change freely.
 */
export type Link<Out, In = Out> = {
  send(message: Out): void;
  /** Everything that's arrived since last asked. */
  receive(): In[];
  close(): void;
  readonly closed: boolean;
};

/** Two ends of a connection inside one page, for practice and for tests. Arrivals can be held up by a few ticks, and everything goes through JSON just as it would for real. */
export function createLoopback<M>(latencyTicks = 0): [Link<M>, Link<M>] {
  type Box = { text: string; wait: number }[];
  const toA: Box = [];
  const toB: Box = [];
  let closed = false;
  const end = (inbox: Box, outbox: Box): Link<M> => ({
    send(message) {
      if (!closed) outbox.push({ text: JSON.stringify(message), wait: latencyTicks });
    },
    receive() {
      const ready: M[] = [];
      while (inbox.length && inbox[0].wait <= 0) ready.push(JSON.parse(inbox.shift()!.text) as M);
      for (const box of inbox) box.wait--;
      return ready;
    },
    close() {
      closed = true;
    },
    get closed() {
      return closed;
    },
  });
  return [end(toA, toB), end(toB, toA)];
}

/** Just what's needed from a browser WebSocket, so that tests can stand in for one. */
export type SocketLike = {
  readonly readyState: number;
  send(text: string): void;
  close(): void;
  onopen: ((event: never) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: never) => void) | null;
  onerror: ((event: never) => void) | null;
};
const SOCKET_OPEN = 1;

/** A Link over a socket. Whatever's sent before it opens goes as soon as it does. Anything `parse` refuses is dropped. */
export function createSocketLink<Out, In>(socket: SocketLike, parse: (text: string) => In | null): Link<Out, In> {
  const inbox: In[] = [];
  const waiting: string[] = [];
  let closed = false;
  socket.onopen = () => {
    for (const text of waiting.splice(0)) socket.send(text);
  };
  socket.onmessage = (event) => {
    if (typeof event.data !== "string") return;
    const message = parse(event.data);
    if (message) inbox.push(message);
  };
  socket.onclose = () => {
    closed = true;
  };
  socket.onerror = () => {
    closed = true;
  };
  return {
    send(message) {
      if (closed) return;
      const text = JSON.stringify(message);
      if (socket.readyState === SOCKET_OPEN) socket.send(text);
      else waiting.push(text);
    },
    receive: () => inbox.splice(0),
    close() {
      closed = true;
      socket.close();
    },
    get closed() {
      return closed;
    },
  };
}
