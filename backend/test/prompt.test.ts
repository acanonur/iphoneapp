import { describe, expect, it } from 'vitest';
import { buildAgentVariables, disclosureLine } from '../src/prompt.js';
import { newTask } from '../src/tasks.js';
import type { SecretaryTask } from '../src/types.js';

const baseTask: SecretaryTask = newTask({
  id: 't1',
  deviceId: 'd1',
  kind: 'call',
  goal: 'Book a dentist appointment for next week',
  phoneNumber: '+493012345678',
  language: 'de',
  summaryLanguage: 'en',
  userName: 'Ali',
});

describe('disclosureLine', () => {
  it('identifies as AI in German and includes the user name', () => {
    const line = disclosureLine('de', 'Ali');
    expect(line).toContain('KI-Assistent');
    expect(line).toContain('Ali');
  });

  it('identifies as AI in Turkish', () => {
    const line = disclosureLine('tr', 'Ali');
    expect(line).toContain('yapay zekâ');
    expect(line).toContain('Ali');
  });

  it('identifies as AI in English without a name', () => {
    const line = disclosureLine('en', null);
    expect(line).toContain('AI assistant');
    expect(line).not.toContain('null');
  });
});

describe('buildAgentVariables', () => {
  it('exposes goal, disclosure and language name', () => {
    const vars = buildAgentVariables(baseTask);
    expect(vars.goal).toBe(baseTask.goal);
    expect(vars.language_name).toBe('German');
    expect(vars.disclosure).toContain('KI-Assistent');
    expect(vars.user_name).toBe('Ali');
  });

  it('uses a neutral name when userName is missing', () => {
    const vars = buildAgentVariables({ ...baseTask, userName: null });
    expect(vars.user_name).toBe('the client');
  });
});
