/**
 * Realtime fan-out.
 *
 * The sync protocol is pull-based, so the only thing pushed over the socket is
 * a nudge: "the space is now at revision N, come and get it". That keeps the
 * socket stateless — a phone that misses a message, sleeps, or loses signal in a
 * supermarket basement recovers completely on its next pull, with no replay
 * buffer to get out of step.
 *
 * Presence is the exception and is genuinely live: it exists so that when Tugce
 * ticks off the milk, Onur sees it happen while he is standing in the next aisle.
 */

export interface Socket {
  send(data: string): void;
  readyState: number;
  close(): void;
}

export interface PresenceEntry {
  userId: string;
  name: string;
  context: string;
  at: number;
}

interface Client {
  socket: Socket;
  spaceId: string;
  userId: string;
  name: string;
}

/** Presence older than this is dropped: someone has left the shop or the app. */
const PRESENCE_TTL_MS = 90_000;
const OPEN = 1;

export class Hub {
  private readonly clients = new Set<Client>();
  private readonly presence = new Map<string, Map<string, PresenceEntry>>();

  add(socket: Socket, spaceId: string, userId: string, name: string): Client {
    const client: Client = { socket, spaceId, userId, name };
    this.clients.add(client);
    // A joining client gets the current presence roster immediately, so the
    // shopping screen is correct before anything else happens.
    this.sendTo(client, { type: 'presence', entries: this.presenceFor(spaceId) });
    return client;
  }

  remove(client: Client): void {
    this.clients.delete(client);

    const stillConnected = [...this.clients].some(
      (c) => c.spaceId === client.spaceId && c.userId === client.userId,
    );
    if (!stillConnected) {
      this.presence.get(client.spaceId)?.delete(client.userId);
      this.broadcastPresence(client.spaceId);
    }
  }

  /** Tell everyone in a space that there is new data to pull. */
  publishRev(spaceId: string, rev: number, exceptUserId?: string): void {
    this.broadcast(spaceId, { type: 'rev', rev }, exceptUserId);
  }

  setPresence(spaceId: string, userId: string, name: string, context: string): void {
    let roster = this.presence.get(spaceId);
    if (!roster) {
      roster = new Map();
      this.presence.set(spaceId, roster);
    }
    roster.set(userId, { userId, name, context, at: Date.now() });
    this.broadcastPresence(spaceId);
  }

  clearPresence(spaceId: string, userId: string): void {
    this.presence.get(spaceId)?.delete(userId);
    this.broadcastPresence(spaceId);
  }

  presenceFor(spaceId: string): PresenceEntry[] {
    const roster = this.presence.get(spaceId);
    if (!roster) return [];

    const cutoff = Date.now() - PRESENCE_TTL_MS;
    for (const [userId, entry] of roster) {
      if (entry.at < cutoff) roster.delete(userId);
    }
    return [...roster.values()];
  }

  private broadcastPresence(spaceId: string): void {
    this.broadcast(spaceId, { type: 'presence', entries: this.presenceFor(spaceId) });
  }

  private broadcast(spaceId: string, message: unknown, exceptUserId?: string): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.spaceId !== spaceId) continue;
      if (exceptUserId && client.userId === exceptUserId) continue;
      this.write(client, payload);
    }
  }

  private sendTo(client: Client, message: unknown): void {
    this.write(client, JSON.stringify(message));
  }

  private write(client: Client, payload: string): void {
    try {
      if (client.socket.readyState === OPEN) client.socket.send(payload);
    } catch {
      // A dead socket is not an error worth failing a request over; the client
      // will reconnect and pull whatever it missed.
      this.clients.delete(client);
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }

  closeAll(): void {
    for (const client of this.clients) {
      try {
        client.socket.close();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
    this.presence.clear();
  }
}
