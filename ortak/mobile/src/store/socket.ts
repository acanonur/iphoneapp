/**
 * The realtime connection.
 *
 * The socket only ever carries nudges ("the space is now at revision N") and
 * presence. All actual data still moves through the normal pull, which is what
 * makes losing the connection a non-event: reconnect, pull, carry on.
 *
 * Reconnection backs off to 30 seconds so a phone left on a lock screen with no
 * signal isn't retrying in a tight loop all night.
 */

import { useStore } from './useStore.js';

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let attempt = 0;
let wanted = false;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const HEARTBEAT_MS = 25_000;

function clearTimers(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function scheduleReconnect(): void {
  if (!wanted || reconnectTimer) return;
  const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  attempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, delay);
}

export function connectSocket(): void {
  wanted = true;
  const state = useStore.getState();
  if (!state.token || state.status !== 'ready') return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const url = state.api().socketUrl();
  if (!url) return;

  try {
    socket = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    attempt = 0;
    useStore.setState({ online: true });
    // A reconnect may have missed several revisions, so pull unconditionally.
    void useStore.getState().sync({ force: true });

    heartbeat = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_MS);
  };

  socket.onmessage = (event: WebSocketMessageEvent) => {
    let message: { type?: string; rev?: number; entries?: unknown };
    try {
      message = JSON.parse(String(event.data)) as typeof message;
    } catch {
      return;
    }

    switch (message.type) {
      case 'rev':
      case 'hello':
      case 'pong': {
        if (typeof message.rev === 'number' && message.rev > useStore.getState().rev) {
          void useStore.getState().sync();
        }
        break;
      }
      case 'presence': {
        if (Array.isArray(message.entries)) {
          useStore.getState().setPresence(message.entries as never[]);
        }
        break;
      }
    }
  };

  socket.onerror = () => {
    useStore.setState({ online: false });
  };

  socket.onclose = () => {
    clearTimers();
    socket = null;
    useStore.setState({ online: false });
    scheduleReconnect();
  };
}

export function disconnectSocket(): void {
  wanted = false;
  clearTimers();
  attempt = 0;
  if (socket) {
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // already gone
    }
    socket = null;
  }
}

/**
 * Announce what this person is doing, so the other phone can show it.
 *
 * Sent over the socket when it's up (instant, and free) and falls back to the
 * HTTP endpoint when it isn't.
 */
export function announcePresence(context: string): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'presence', context }));
    return;
  }
  void useStore
    .getState()
    .api()
    .presence(context)
    .then((result) => useStore.getState().setPresence(result.entries))
    .catch(() => undefined);
}
