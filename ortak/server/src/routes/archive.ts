/**
 * The chat archive: importing WhatsApp exports and browsing what came out.
 *
 * ## Why importing a file is the only way in
 *
 * WhatsApp has no API that lets another app read your personal chats. The
 * Business API only covers messages sent to a business number, and libraries
 * that drive WhatsApp Web are against the Terms of Service and get numbers
 * banned. What WhatsApp does support is the export built into the app itself, so
 * that is what this endpoint consumes:
 *
 *   WhatsApp → open the chat → ⋮ (or the contact name on iOS) → Export chat
 *   → Without media → share into Ortak
 *
 * Re-exporting the same group later is safe and cheap: message ids are derived
 * from a fingerprint of (timestamp, author, text), so a second import of an
 * overlapping range adds only the genuinely new messages.
 */

import type { FastifyInstance } from 'fastify';
import type { Ctx } from '../context.js';
import { newId } from '../db.js';
import { parseWhatsAppExport, chatNameFromFilename } from '../../../shared/src/whatsapp.js';

interface ImportBody {
  filename?: string;
  chatName?: string;
  content: string;
  utcOffsetMinutes?: number;
  dateOrder?: 'dmy' | 'mdy' | 'ymd';
  /** Parse and report, but write nothing. Used by the import preview screen. */
  dryRun?: boolean;
}

const IMPORT_SCHEMA = {
  body: {
    type: 'object',
    required: ['content'],
    additionalProperties: false,
    properties: {
      filename: { type: 'string', maxLength: 500 },
      chatName: { type: 'string', maxLength: 300 },
      content: { type: 'string', minLength: 1 },
      utcOffsetMinutes: { type: 'number', minimum: -840, maximum: 840 },
      dateOrder: { type: 'string', enum: ['dmy', 'mdy', 'ymd'] },
      dryRun: { type: 'boolean' },
    },
  },
} as const;

interface SaveMessageBody {
  body: string;
  chatName?: string;
  author?: string;
  sentAt?: number;
  starred?: boolean;
}

const SAVE_MESSAGE_SCHEMA = {
  body: {
    type: 'object',
    required: ['body'],
    additionalProperties: false,
    properties: {
      body: { type: 'string', minLength: 1, maxLength: 20000 },
      chatName: { type: 'string', maxLength: 300 },
      author: { type: 'string', maxLength: 200 },
      sentAt: { type: 'number' },
      starred: { type: 'boolean' },
    },
  },
} as const;

export function registerArchiveRoutes(app: FastifyInstance, ctx: Ctx): void {
  /**
   * Import an exported chat.
   *
   * Returns counts rather than the messages themselves — a five-year group chat
   * is tens of thousands of rows, and the client picks them up through the
   * normal sync pull.
   */
  app.post<{ Body: ImportBody }>('/api/archive/import', { schema: IMPORT_SCHEMA }, async (request, reply) => {
    const { spaceId, id: userId } = request.user;
    const body = request.body;

    if (Buffer.byteLength(body.content, 'utf8') > ctx.config.maxImportBytes) {
      return reply.code(413).send({
        error: 'import_too_large',
        message: `Export is larger than ${Math.round(ctx.config.maxImportBytes / 1024 / 1024)} MB. Export without media, or split the range.`,
      });
    }

    const parsed = parseWhatsAppExport(body.content, {
      utcOffsetMinutes: body.utcOffsetMinutes ?? 0,
      dateOrder: body.dateOrder,
      filename: body.filename,
    });

    const chatName =
      body.chatName?.trim() ||
      parsed.chatName ||
      (body.filename ? chatNameFromFilename(body.filename) : null) ||
      'Imported chat';

    if (parsed.messages.length === 0) {
      return reply.code(422).send({
        error: 'no_messages',
        message: parsed.warnings[0] ?? 'No messages could be read from this file.',
        warnings: parsed.warnings,
      });
    }

    // The preview screen shows what would be imported before committing.
    if (body.dryRun) {
      return {
        dryRun: true,
        chatName,
        messageCount: parsed.messages.length,
        participants: parsed.participants,
        firstAt: parsed.firstAt,
        lastAt: parsed.lastAt,
        dateOrder: parsed.dateOrder,
        dateOrderAmbiguous: parsed.dateOrderAmbiguous,
        warnings: parsed.warnings,
        sample: parsed.messages.slice(0, 5).map((m) => ({
          sentAt: m.sentAt,
          author: m.author,
          body: m.body.slice(0, 200),
          kind: m.kind,
        })),
      };
    }

    const importId = newId();
    const now = Date.now();

    // Message ids are deterministic per (chat, fingerprint), so re-importing an
    // overlapping export updates those rows instead of duplicating them.
    const rows = parsed.messages.map((m) => ({
      id: `wa-${m.fingerprint}`,
      updatedAt: now,
      deleted: false,
      chatName,
      author: m.author,
      sentAt: m.sentAt,
      body: m.body,
      kind: m.kind,
      mediaName: m.mediaName,
      source: 'whatsapp-export' as const,
      importId,
      starred: false,
      tags: [],
    }));

    const existingIds = new Set(
      (
        ctx.db
          .prepare(
            `SELECT id FROM archive_messages WHERE space_id = ? AND id IN (${rows.map(() => '?').join(',')})`,
          )
          .all(spaceId, ...rows.map((r) => r.id)) as { id: string }[]
      ).map((r) => r.id),
    );
    const addedCount = rows.filter((r) => !existingIds.has(r.id)).length;

    const { rev } = ctx.sync.writeRows(spaceId, userId, 'archiveMessages', rows);

    ctx.db
      .prepare(
        `INSERT INTO archive_imports
           (id, space_id, chat_name, filename, message_count, added_count, first_at, last_at, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        importId,
        spaceId,
        chatName,
        body.filename ?? 'export.txt',
        parsed.messages.length,
        addedCount,
        parsed.firstAt,
        parsed.lastAt,
        now,
        userId,
      );

    ctx.hub.publishRev(spaceId, rev);

    return {
      importId,
      chatName,
      messageCount: parsed.messages.length,
      addedCount,
      duplicateCount: parsed.messages.length - addedCount,
      participants: parsed.participants,
      firstAt: parsed.firstAt,
      lastAt: parsed.lastAt,
      dateOrder: parsed.dateOrder,
      dateOrderAmbiguous: parsed.dateOrderAmbiguous,
      warnings: parsed.warnings,
      rev,
    };
  });

  /**
   * Keep a single forwarded message.
   *
   * The archive is deliberately not part of the sync set — a five-year group
   * chat is tens of thousands of rows and mirroring it onto both phones would
   * make every sync slow. That meant the capture screen's "Keep message" had
   * nowhere to go: it wrote into the local archive map, which the client never
   * pushes, so the message sat on one phone forever while the screen claimed
   * both of you could see it. This is the way in for one message at a time.
   */
  app.post<{ Body: SaveMessageBody }>(
    '/api/archive/messages',
    { schema: SAVE_MESSAGE_SCHEMA },
    async (request) => {
      const { spaceId, id: userId } = request.user;
      const body = request.body;
      const now = Date.now();

      const row = {
        id: newId(),
        updatedAt: now,
        deleted: false,
        chatName: body.chatName?.trim() || 'Saved messages',
        author: body.author?.trim() || null,
        sentAt: body.sentAt ?? now,
        body: body.body,
        kind: 'message' as const,
        mediaName: null,
        source: 'share' as const,
        importId: null,
        starred: body.starred ?? true,
        tags: [],
      };

      const { rev } = ctx.sync.writeRows(spaceId, userId, 'archiveMessages', [row]);
      ctx.hub.publishRev(spaceId, rev);

      return { id: row.id, chatName: row.chatName, sentAt: row.sentAt, rev };
    },
  );

  /** The chats we hold, with sizes and date ranges — the archive's front page. */
  app.get('/api/archive/chats', async (request) => {
    const rows = ctx.db
      .prepare(
        `SELECT chat_name,
                COUNT(*)        AS message_count,
                MIN(sent_at)    AS first_at,
                MAX(sent_at)    AS last_at,
                SUM(starred)    AS starred_count
         FROM archive_messages
         WHERE space_id = ? AND deleted = 0
         GROUP BY chat_name
         ORDER BY last_at DESC`,
      )
      .all(request.user.spaceId) as {
      chat_name: string;
      message_count: number;
      first_at: number;
      last_at: number;
      starred_count: number;
    }[];

    return {
      chats: rows.map((r) => ({
        chatName: r.chat_name,
        messageCount: r.message_count,
        firstAt: r.first_at,
        lastAt: r.last_at,
        starredCount: r.starred_count,
      })),
    };
  });

  /**
   * A window of messages from one chat.
   *
   * Paged by timestamp rather than offset so that scrolling back through a long
   * group chat stays fast and doesn't shift when a new import lands.
   */
  app.get<{
    Querystring: { chat: string; before?: string; after?: string; limit?: string; starred?: string };
  }>('/api/archive/messages', async (request, reply) => {
    const { chat, before, after, limit, starred } = request.query;
    if (!chat) return reply.code(400).send({ error: 'missing_chat', message: 'chat is required' });

    const take = Math.min(Math.max(Number(limit ?? 100), 1), 500);
    const where = ['space_id = ?', 'deleted = 0', 'chat_name = ?'];
    const params: unknown[] = [request.user.spaceId, chat];

    if (before) {
      where.push('sent_at < ?');
      params.push(Number(before));
    }
    if (after) {
      where.push('sent_at > ?');
      params.push(Number(after));
    }
    if (starred === 'true') where.push('starred = 1');

    const rows = ctx.db
      .prepare(
        `SELECT id, chat_name, author, sent_at, body, kind, media_name, starred, tags
         FROM archive_messages
         WHERE ${where.join(' AND ')}
         ORDER BY sent_at DESC
         LIMIT ?`,
      )
      .all(...(params as never[]), take) as {
      id: string;
      chat_name: string;
      author: string | null;
      sent_at: number;
      body: string;
      kind: string;
      media_name: string | null;
      starred: number;
      tags: string;
    }[];

    return {
      messages: rows
        .map((r) => ({
          id: r.id,
          chatName: r.chat_name,
          author: r.author,
          sentAt: r.sent_at,
          body: r.body,
          kind: r.kind,
          mediaName: r.media_name,
          starred: Boolean(r.starred),
          tags: JSON.parse(r.tags) as string[],
        }))
        .reverse(),
      hasMore: rows.length === take,
    };
  });

  /** Import history, so it's clear what has already been archived. */
  app.get('/api/archive/imports', async (request) => {
    const rows = ctx.db
      .prepare(
        `SELECT id, chat_name, filename, message_count, added_count, first_at, last_at, created_at, created_by
         FROM archive_imports WHERE space_id = ? ORDER BY created_at DESC LIMIT 100`,
      )
      .all(request.user.spaceId) as Record<string, unknown>[];

    return {
      imports: rows.map((r) => ({
        id: r.id,
        chatName: r.chat_name,
        filename: r.filename,
        messageCount: r.message_count,
        addedCount: r.added_count,
        firstAt: r.first_at,
        lastAt: r.last_at,
        createdAt: r.created_at,
        createdBy: r.created_by,
      })),
    };
  });

  /**
   * Remove everything that came in from one import.
   *
   * Tombstones rather than hard deletes, so the other phone drops the messages
   * too instead of syncing them straight back.
   */
  app.delete<{ Params: { importId: string } }>('/api/archive/imports/:importId', async (request, reply) => {
    const { spaceId, id: userId } = request.user;
    const { importId } = request.params;

    const owned = ctx.db
      .prepare('SELECT id FROM archive_imports WHERE id = ? AND space_id = ?')
      .get(importId, spaceId) as { id: string } | undefined;
    if (!owned) return reply.code(404).send({ error: 'not_found', message: 'Unknown import' });

    const rows = ctx.db
      .prepare('SELECT * FROM archive_messages WHERE space_id = ? AND import_id = ? AND deleted = 0')
      .all(spaceId, importId) as Record<string, unknown>[];

    const now = Date.now();
    const tombstones = rows.map((r) => ({
      id: r.id as string,
      updatedAt: now,
      deleted: true,
      chatName: r.chat_name as string,
      sentAt: r.sent_at as number,
    }));

    const { rev } = ctx.sync.writeRows(spaceId, userId, 'archiveMessages', tombstones);
    ctx.db.prepare('DELETE FROM archive_imports WHERE id = ?').run(importId);
    ctx.hub.publishRev(spaceId, rev);

    return { deleted: tombstones.length, rev };
  });
}
