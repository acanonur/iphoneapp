import { describe, expect, it } from 'vitest';
import {
  AGENT_PROMPT_TEMPLATE,
  INBOUND_PROMPT_TEMPLATE,
  RECORDED,
  buildAgentVariables,
  disclosureLine,
  greetingLine,
} from '../src/prompt.js';
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

describe('the recording notice', () => {
  // The phone service records every real call. Recording someone without
  // telling them is a crime in Germany (§ 201 StGB) and Türkiye (TCK 133), so
  // the opening of every call says it — placed or answered, with or without
  // a name, in every language.
  const languages = ['de', 'en', 'tr'] as const;
  const names = ['Ali', null];

  it('is in the opening of every call Yaver places', () => {
    for (const language of languages) {
      for (const name of names) {
        const line = disclosureLine(language, name);
        expect(line.endsWith(RECORDED[language])).toBe(true);
      }
    }
  });

  it('is in the greeting of every call Yaver answers, before the question', () => {
    for (const language of languages) {
      for (const name of names) {
        const line = greetingLine(language, name);
        expect(line).toContain(RECORDED[language]);
        expect(line.indexOf(RECORDED[language])).toBeLessThan(line.lastIndexOf('?'));
      }
    }
  });

  it('is what the agents say when asked — never that nothing is recorded', () => {
    for (const prompt of [AGENT_PROMPT_TEMPLATE, INBOUND_PROMPT_TEMPLATE]) {
      expect(prompt).toContain('yes, the call is recorded');
      expect(prompt).not.toContain('not kept');
    }
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
