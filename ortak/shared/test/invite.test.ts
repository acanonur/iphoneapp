import { describe, expect, it } from 'vitest';
import {
  buildInviteMessage,
  buildJoinLink,
  normaliseInviteCode,
  normaliseServerUrl,
  parseJoinInput,
} from '../src/invite.js';

describe('normaliseInviteCode', () => {
  it('accepts the form the app displays', () => {
    expect(normaliseInviteCode('ABCD-2345')).toBe('ABCD-2345');
  });

  it('forgives how people actually retype it', () => {
    expect(normaliseInviteCode('abcd2345')).toBe('ABCD-2345');
    expect(normaliseInviteCode('  abcd - 2345 ')).toBe('ABCD-2345');
    expect(normaliseInviteCode('ABCD—2345')).toBe('ABCD-2345'); // em dash from autocorrect
  });

  it('rejects anything that is not a whole code', () => {
    expect(normaliseInviteCode('ABCD')).toBeNull();
    expect(normaliseInviteCode('')).toBeNull();
    expect(normaliseInviteCode('ABCD-23456')).toBeNull();
    // 0, O, 1 and I are not in the alphabet, so a code full of them is not one.
    expect(normaliseInviteCode('0O1I0O1I')).toBeNull();
  });
});

describe('normaliseServerUrl', () => {
  it('drops trailing slashes but keeps a path prefix', () => {
    expect(normaliseServerUrl('https://ortak.example.com/')).toBe('https://ortak.example.com');
    expect(normaliseServerUrl('  http://192.168.2.56:8788  ')).toBe('http://192.168.2.56:8788');
    // A server behind a reverse proxy can live under a prefix; losing it would
    // point every request at the wrong place.
    expect(normaliseServerUrl('https://example.com/ortak/')).toBe('https://example.com/ortak');
  });

  it('assumes http when no scheme is given, which is the home-network case', () => {
    expect(normaliseServerUrl('192.168.2.56:8788')).toBe('http://192.168.2.56:8788');
  });

  it('returns null for nothing usable', () => {
    expect(normaliseServerUrl('')).toBeNull();
    expect(normaliseServerUrl('   ')).toBeNull();
  });
});

describe('join links', () => {
  const invite = { serverUrl: 'http://192.168.2.56:8788', inviteCode: 'ABCD-2345' };

  it('round-trips through a link', () => {
    expect(parseJoinInput(buildJoinLink(invite))).toEqual({
      inviteCode: 'ABCD-2345',
      serverUrl: 'http://192.168.2.56:8788',
    });
  });

  it('survives being pasted inside a whole forwarded message', () => {
    const message = buildInviteMessage({ ...invite, spaceName: 'Ev', invitedBy: 'Can' });
    expect(message).toContain('Join Ev on Ortak');
    expect(message).toContain('Can invited you');
    expect(parseJoinInput(message)).toEqual({
      inviteCode: 'ABCD-2345',
      serverUrl: 'http://192.168.2.56:8788',
    });
  });

  it('finds the link even with chat noise around it', () => {
    const pasted = `hey!! join this ${buildJoinLink(invite)} ok? 😀`;
    expect(parseJoinInput(pasted)).toEqual({
      inviteCode: 'ABCD-2345',
      serverUrl: 'http://192.168.2.56:8788',
    });
  });

  it('encodes the server so a port or path cannot break the query', () => {
    const link = buildJoinLink(invite);
    expect(link).toContain('server=http%3A%2F%2F192.168.2.56%3A8788');
    expect(link.split('?')[1]!.split('&')).toHaveLength(2);
  });
});

describe('parseJoinInput on bare text', () => {
  it('takes a bare code, with no server', () => {
    expect(parseJoinInput('abcd2345')).toEqual({ inviteCode: 'ABCD-2345', serverUrl: null });
  });

  it('does not mistake a paragraph for a code', () => {
    const paragraph =
      'Hey, can you add me to the shopping list thing you were talking about yesterday?';
    expect(parseJoinInput(paragraph)).toEqual({ inviteCode: null, serverUrl: null });
  });

  it('returns nulls for empty input', () => {
    expect(parseJoinInput('   ')).toEqual({ inviteCode: null, serverUrl: null });
  });

  it('keeps the server from a link whose code is unusable', () => {
    const broken = 'ortak://join?code=XX&server=https%3A%2F%2Fortak.example.com';
    expect(parseJoinInput(broken)).toEqual({
      inviteCode: null,
      serverUrl: 'https://ortak.example.com',
    });
  });
});
