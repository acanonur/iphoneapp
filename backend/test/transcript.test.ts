import { describe, expect, it } from 'vitest';
import { linesToText, spokenLength, textToLines, tidyLines } from '../src/transcript.js';
import { verifyRetellSignature, signRetellPayload } from '../src/retell-signature.js';

describe('transcript', () => {
  it('names the speakers in the language of the call', () => {
    const lines = [
      { role: 'assistant' as const, text: 'Guten Tag!' },
      { role: 'other' as const, text: 'Hallo.' },
    ];
    expect(linesToText(lines, 'de', 'outbound')).toBe('KI-Assistent: Guten Tag!\nGesprächspartner: Hallo.');
    expect(linesToText(lines, 'tr', 'inbound')).toBe('Yapay zekâ asistanı: Guten Tag!\nArayan: Hallo.');
  });

  it('reads a flat provider transcript back into turns', () => {
    const lines = textToLines('Agent: Guten Tag!\nUser: Praxis am Park.\nAgent: Ich rufe wegen eines Termins an.');
    expect(lines).toEqual([
      { role: 'assistant', text: 'Guten Tag!' },
      { role: 'other', text: 'Praxis am Park.' },
      { role: 'assistant', text: 'Ich rufe wegen eines Termins an.' },
    ]);
  });

  it('does not mistake a time of day for a speaker', () => {
    const lines = textToLines('User: Wir hätten am\nDienstag um 10:30 Uhr etwas frei.');
    expect(lines).toEqual([{ role: 'other', text: 'Wir hätten am Dienstag um 10:30 Uhr etwas frei.' }]);
  });

  it('merges consecutive turns by one speaker and drops empty ones', () => {
    const tidy = tidyLines([
      { role: 'other', text: ' Hallo ' },
      { role: 'other', text: 'wer   ist da?' },
      { role: 'assistant', text: '   ' },
      { role: 'assistant', text: 'Ein KI-Assistent.' },
    ]);
    expect(tidy).toEqual([
      { role: 'other', text: 'Hallo wer ist da?' },
      { role: 'assistant', text: 'Ein KI-Assistent.' },
    ]);
    expect(spokenLength(tidy)).toBe('Hallo wer ist da?'.length + 'Ein KI-Assistent.'.length);
  });
});

describe('Retell webhook signature', () => {
  const body = '{"event":"call_started","call":{"call_id":"call_1"}}';
  const key = 'key_test';
  const at = 1_700_000_000_000;
  // Produced by the official SDK and reproduced with openssl.
  const signature = 'v=1700000000000,d=09567e5dd87ae02f1df698b4aa9a1f20cb5a858c5e1f684ef210bbc10fd24146';

  it('matches the known answer from the official SDK', () => {
    expect(signRetellPayload(body, key, at)).toBe(signature);
    expect(verifyRetellSignature(body, key, signature, { now: at })).toBe(true);
    expect(verifyRetellSignature(Buffer.from(body), key, signature, { now: at })).toBe(true);
  });

  it('rejects a changed body, a wrong key, an old signature and a missing one', () => {
    expect(verifyRetellSignature(body.replace('call_1', 'call_2'), key, signature, { now: at })).toBe(false);
    expect(verifyRetellSignature(body, 'another_key', signature, { now: at })).toBe(false);
    expect(verifyRetellSignature(body, key, signature, { now: at + 5 * 60_000 + 1 })).toBe(false);
    expect(verifyRetellSignature(body, key, undefined, { now: at })).toBe(false);
    expect(verifyRetellSignature(body, key, 'v=1700000000,d=abc', { now: at })).toBe(false);
    expect(verifyRetellSignature(body, '', signature, { now: at })).toBe(false);
  });

  it('accepts a signature exactly five minutes old', () => {
    expect(verifyRetellSignature(body, key, signature, { now: at + 5 * 60_000 })).toBe(true);
  });
});
