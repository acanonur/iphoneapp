import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskStore } from '../src/db.js';
import { newTask } from '../src/tasks.js';
import type { SecretaryTask } from '../src/types.js';

let directory: string | null = null;

function tempDbPath(): string {
  directory = mkdtempSync(join(tmpdir(), 'aisecretary-'));
  return join(directory, 'calls.db');
}

afterEach(() => {
  if (directory) {
    rmSync(directory, { recursive: true, force: true });
    directory = null;
  }
});

const task: SecretaryTask = newTask({
  id: 't1',
  deviceId: 'd1',
  kind: 'letter',
  goal: 'Read the letter from the Finanzamt',
  language: 'de',
  summaryLanguage: 'tr',
  userName: 'Can',
  documentText: 'Sehr geehrte Damen und Herren …',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

describe('TaskStore', () => {
  it('round-trips a document task, keeping a missing phone number null', () => {
    const store = new TaskStore(tempDbPath());
    store.create(task);
    const stored = store.get('t1');
    expect(stored?.kind).toBe('letter');
    expect(stored?.phoneNumber).toBeNull();
    expect(stored?.documentText).toContain('Sehr geehrte');

    store.update('t1', { status: 'completed', summary: 'Fertig', todo: 'Beleg senden' });
    const updated = store.get('t1');
    expect(updated?.status).toBe('completed');
    expect(updated?.summary).toBe('Fertig');
    expect(updated?.todo).toBe('Beleg senden');
    store.close();
  });

  it('migrates a database written by the call-only first version', () => {
    const path = tempDbPath();

    // Recreate the original schema and put a call in it.
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE calls (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        language TEXT NOT NULL,
        summary_language TEXT NOT NULL,
        user_name TEXT,
        status TEXT NOT NULL,
        provider_call_id TEXT,
        transcript TEXT,
        summary TEXT,
        outcome TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacy
      .prepare(
        `INSERT INTO calls (id, device_id, goal, phone_number, language, summary_language,
          user_name, status, provider_call_id, transcript, summary, outcome, error,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'old1', 'd1', 'Book a dentist appointment', '+493012345678', 'de', 'tr',
        'Can', 'completed', 'mock_1', 'KI-Assistent: Hallo', 'Randevu alındı',
        'achieved', null, new Date(0).toISOString(), new Date(0).toISOString(),
      );
    legacy.close();

    const store = new TaskStore(path);
    const migrated = store.get('old1');
    expect(migrated).toBeDefined();
    expect(migrated?.kind).toBe('call');
    expect(migrated?.phoneNumber).toBe('+493012345678');
    expect(migrated?.summary).toBe('Randevu alındı');
    expect(migrated?.outcome).toBe('achieved');
    // The columns the new kinds need are there and empty.
    expect(migrated?.documentText).toBeNull();
    expect(migrated?.todo).toBeNull();

    // And the migrated store still accepts the new kinds.
    store.create({ ...task, id: 't2' });
    expect(store.get('t2')?.kind).toBe('letter');
    expect(store.listByDevice('d1')).toHaveLength(2);
    store.close();
  });

  it('is idempotent across reopens', () => {
    const path = tempDbPath();
    const first = new TaskStore(path);
    first.create(task);
    first.close();

    const second = new TaskStore(path);
    expect(second.get('t1')?.goal).toContain('Finanzamt');
    second.close();
  });

  it('stores the turns of a call and reads them back in order', () => {
    const store = new TaskStore(tempDbPath());
    store.create(newTask({ id: 'c1', deviceId: 'd1', kind: 'call', goal: 'Book a table' }));
    store.update('c1', {
      lines: [
        { role: 'other', text: 'Praxis am Park, guten Tag.' },
        { role: 'assistant', text: 'Guten Tag! Hier spricht ein KI-Assistent.' },
      ],
      simulated: true,
      errorCode: 'cancelled',
      summarySource: 'script',
    });
    const stored = store.get('c1');
    expect(stored?.lines).toEqual([
      { role: 'other', text: 'Praxis am Park, guten Tag.' },
      { role: 'assistant', text: 'Guten Tag! Hier spricht ein KI-Assistent.' },
    ]);
    expect(stored?.simulated).toBe(true);
    expect(stored?.direction).toBe('outbound');
    expect(stored?.errorCode).toBe('cancelled');
    expect(stored?.summarySource).toBe('script');
  });

  it('never lets an update change who a task belongs to or what it is', () => {
    const store = new TaskStore(tempDbPath());
    store.create(newTask({ id: 'c2', deviceId: 'd1', kind: 'call', goal: 'Book a table' }));
    store.update('c2', {
      deviceId: 'someone-else',
      kind: 'letter',
      direction: 'inbound',
      id: 'other',
    });
    expect(store.get('c2')).toMatchObject({ deviceId: 'd1', kind: 'call', direction: 'outbound' });
  });

  it('keeps settings, creating one only the first time it is asked for', () => {
    const path = tempDbPath();
    const store = new TaskStore(path);
    const first = store.settingOrCreate('access_key', () => 'made-once');
    const second = store.settingOrCreate('access_key', () => 'made-twice');
    expect(first).toBe('made-once');
    expect(second).toBe('made-once');
    store.close();
    // Still there after a restart.
    expect(new TaskStore(path).getSetting('access_key')).toBe('made-once');
  });

  it('answers incoming calls for whoever asked for it most recently', async () => {
    const store = new TaskStore(tempDbPath());
    const base = { name: null, language: 'en' as const, answerNote: null };
    store.saveProfile({ ...base, deviceId: 'a', answerCalls: true });
    await new Promise((resolve) => setTimeout(resolve, 5));
    store.saveProfile({ ...base, deviceId: 'b', answerCalls: false });
    expect(store.inboundOwner()?.deviceId).toBe('a');
    await new Promise((resolve) => setTimeout(resolve, 5));
    store.saveProfile({ ...base, deviceId: 'c', answerCalls: true });
    expect(store.inboundOwner()?.deviceId).toBe('c');
  });
});
