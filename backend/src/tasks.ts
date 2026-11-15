import { randomUUID } from 'node:crypto';
import type { SecretaryTask } from './types.js';

/**
 * A new task with every field at its starting value. Callers pass only what
 * they know; a field added to the task later needs a default in one place.
 */
export function newTask(
  fields: Pick<SecretaryTask, 'deviceId' | 'kind' | 'goal'> & Partial<SecretaryTask>,
): SecretaryTask {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    phoneNumber: null,
    language: 'de',
    summaryLanguage: 'en',
    userName: null,
    status: 'queued',
    direction: 'outbound',
    simulated: false,
    providerCallId: null,
    documentText: null,
    lines: [],
    transcript: null,
    summary: null,
    summarySource: null,
    result: null,
    todo: null,
    todoWhen: null,
    outcome: null,
    durationSeconds: null,
    error: null,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}
