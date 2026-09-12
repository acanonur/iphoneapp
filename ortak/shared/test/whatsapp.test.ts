import { describe, expect, it } from 'vitest';
import { parseWhatsAppExport, chatNameFromFilename, stableHash } from '../src/whatsapp.js';

/** U+200E, which iOS sprinkles in front of lines and attachment markers. */
const LRM = '‎';
/** U+202F, the narrow no-break space iOS 17+ puts before AM/PM. */
const NNBSP = ' ';

describe('parseWhatsAppExport — platform formats', () => {
  it('parses the iOS bracketed format with direction marks', () => {
    const text = [
      `${LRM}[16.08.2025, 14:03:11] Onur: Merhaba`,
      `${LRM}[16.08.2025, 14:04:00] Tugce: Selam, akşam ne yapıyoruz?`,
    ].join('\n');

    const result = parseWhatsAppExport(text);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]!.author).toBe('Onur');
    expect(result.messages[0]!.body).toBe('Merhaba');
    expect(result.messages[1]!.author).toBe('Tugce');
    expect(result.messages[1]!.body).toBe('Selam, akşam ne yapıyoruz?');
    expect(result.participants).toEqual(['Onur', 'Tugce']);
  });

  it('parses the Android dash format', () => {
    const text = [
      '16.08.2025, 14:03 - Onur: Sütü aldın mı?',
      '16.08.2025, 14:05 - Tugce: Aldım',
    ].join('\n');

    const result = parseWhatsAppExport(text);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]!.author).toBe('Onur');
    expect(result.messages[1]!.body).toBe('Aldım');
  });

  it('parses the US 12-hour format with a narrow no-break space', () => {
    const text = `[8/16/25, 2:03:11${NNBSP}PM] Onur: Hi`;
    const result = parseWhatsAppExport(text);
    expect(result.messages).toHaveLength(1);
    expect(result.dateOrder).toBe('mdy');
    expect(new Date(result.messages[0]!.sentAt).toISOString()).toBe('2025-08-16T14:03:11.000Z');
  });

  it('parses a 2-digit year and a plain AM marker', () => {
    const text = '8/16/25, 9:05 AM - Onur: morning';
    const result = parseWhatsAppExport(text);
    expect(new Date(result.messages[0]!.sentAt).toISOString()).toBe('2025-08-16T09:05:00.000Z');
  });

  it('maps 12 AM to midnight and 12 PM to noon', () => {
    const result = parseWhatsAppExport(
      ['[8/16/25, 12:00:00 AM] A: midnight', '[8/16/25, 12:00:00 PM] A: noon'].join('\n'),
    );
    expect(new Date(result.messages[0]!.sentAt).toISOString()).toBe('2025-08-16T00:00:00.000Z');
    expect(new Date(result.messages[1]!.sentAt).toISOString()).toBe('2025-08-16T12:00:00.000Z');
  });

  it('parses an ISO-style year-first export', () => {
    const result = parseWhatsAppExport('2025-08-16, 14:03 - Onur: hi');
    expect(result.dateOrder).toBe('ymd');
    expect(new Date(result.messages[0]!.sentAt).toISOString()).toBe('2025-08-16T14:03:00.000Z');
  });

  it('applies the caller-supplied UTC offset', () => {
    const result = parseWhatsAppExport('[16.08.2025, 14:03:11] Onur: hi', { utcOffsetMinutes: 120 });
    // 14:03 local in UTC+2 is 12:03 UTC.
    expect(new Date(result.messages[0]!.sentAt).toISOString()).toBe('2025-08-16T12:03:11.000Z');
  });
});

describe('parseWhatsAppExport — date order inference', () => {
  it('proves day-first when a day exceeds 12', () => {
    const result = parseWhatsAppExport('16.08.2025, 14:03 - A: x');
    expect(result.dateOrder).toBe('dmy');
    expect(result.dateOrderAmbiguous).toBe(false);
  });

  it('proves month-first when the second component exceeds 12', () => {
    const result = parseWhatsAppExport('8/16/2025, 14:03 - A: x');
    expect(result.dateOrder).toBe('mdy');
    expect(result.dateOrderAmbiguous).toBe(false);
  });

  it('flags the genuinely ambiguous case and defaults to day-first', () => {
    const result = parseWhatsAppExport('05.08.2025, 14:03 - A: x');
    expect(result.dateOrder).toBe('dmy');
    expect(result.dateOrderAmbiguous).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/day-first/);
  });

  it('lets the caller override the inference', () => {
    const result = parseWhatsAppExport('05.08.2025, 14:03 - A: x', { dateOrder: 'mdy' });
    expect(result.dateOrderAmbiguous).toBe(false);
    expect(new Date(result.messages[0]!.sentAt).toISOString()).toBe('2025-05-08T14:03:00.000Z');
  });

  it('uses evidence from anywhere in the file, not just the first line', () => {
    const text = ['05.08.2025, 10:00 - A: x', '06.08.2025, 10:00 - A: y', '27.08.2025, 10:00 - A: z'].join('\n');
    const result = parseWhatsAppExport(text);
    expect(result.dateOrder).toBe('dmy');
    expect(result.dateOrderAmbiguous).toBe(false);
    expect(new Date(result.messages[0]!.sentAt).toISOString()).toBe('2025-08-05T10:00:00.000Z');
  });
});

describe('parseWhatsAppExport — message bodies', () => {
  it('keeps multi-line messages together', () => {
    const text = [
      '16.08.2025, 14:03 - Tugce: Alışveriş listesi:',
      '- süt',
      '- ekmek',
      '- yumurta',
      '16.08.2025, 14:04 - Onur: tamam',
    ].join('\n');

    const result = parseWhatsAppExport(text);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]!.body).toBe('Alışveriş listesi:\n- süt\n- ekmek\n- yumurta');
    expect(result.messages[1]!.body).toBe('tamam');
  });

  it('keeps colons inside message bodies', () => {
    const result = parseWhatsAppExport('16.08.2025, 14:03 - Onur: link: https://example.com/a:b');
    expect(result.messages[0]!.author).toBe('Onur');
    expect(result.messages[0]!.body).toBe('link: https://example.com/a:b');
  });

  it('handles a phone number as the author', () => {
    const result = parseWhatsAppExport('16.08.2025, 14:03 - +49 176 1234567: hallo');
    expect(result.messages[0]!.author).toBe('+49 176 1234567');
    expect(result.messages[0]!.body).toBe('hallo');
  });

  it('detects iOS attachments', () => {
    const text = `${LRM}[16.08.2025, 14:05:00] Onur: ${LRM}<attached: 00000042-PHOTO-2025-08-16-14-05-00.jpg>`;
    const result = parseWhatsAppExport(text);
    expect(result.messages[0]!.kind).toBe('media');
    expect(result.messages[0]!.mediaName).toBe('00000042-PHOTO-2025-08-16-14-05-00.jpg');
  });

  it('detects Android attachments', () => {
    const result = parseWhatsAppExport('16.08.2025, 14:05 - Onur: IMG-20250816-WA0001.jpg (file attached)');
    expect(result.messages[0]!.kind).toBe('media');
    expect(result.messages[0]!.mediaName).toBe('IMG-20250816-WA0001.jpg');
  });

  it('detects omitted media in several languages', () => {
    const text = [
      '16.08.2025, 14:05 - A: <Media omitted>',
      '16.08.2025, 14:06 - A: <Medien ausgeschlossen>',
      '16.08.2025, 14:07 - A: <Medya dahil edilmedi>',
    ].join('\n');
    const result = parseWhatsAppExport(text);
    expect(result.messages.map((m) => m.kind)).toEqual(['media', 'media', 'media']);
    expect(result.messages.every((m) => m.mediaName === null)).toBe(true);
  });

  it('detects deleted messages', () => {
    const text = [
      '16.08.2025, 14:05 - A: This message was deleted',
      '16.08.2025, 14:06 - B: Bu mesaj silindi',
    ].join('\n');
    const result = parseWhatsAppExport(text);
    expect(result.messages.map((m) => m.kind)).toEqual(['deleted', 'deleted']);
  });

  it('labels authorless lines as system notices', () => {
    const text = [
      '16.08.2025, 14:00 - Messages and calls are end-to-end encrypted. Tap to learn more.',
      '16.08.2025, 14:01 - Onur created group "Ev"',
      '16.08.2025, 14:02 - Onur: gerçek mesaj',
    ].join('\n');
    const result = parseWhatsAppExport(text);
    expect(result.messages[0]!.kind).toBe('system');
    expect(result.messages[0]!.author).toBeNull();
    expect(result.messages[1]!.kind).toBe('system');
    expect(result.messages[2]!.kind).toBe('message');
    // System notices must not pollute the participant list.
    expect(result.participants).toEqual(['Onur']);
  });
});

describe('parseWhatsAppExport — import bookkeeping', () => {
  it('produces stable fingerprints so re-importing does not duplicate', () => {
    const text = ['16.08.2025, 14:03 - A: hi', '16.08.2025, 14:04 - B: yo'].join('\n');
    const first = parseWhatsAppExport(text);
    const second = parseWhatsAppExport(`${text}\n16.08.2025, 14:10 - A: new message`);

    expect(second.messages.slice(0, 2).map((m) => m.fingerprint)).toEqual(
      first.messages.map((m) => m.fingerprint),
    );
    expect(new Set(second.messages.map((m) => m.fingerprint)).size).toBe(3);
  });

  it('reports the time span and participants', () => {
    const text = [
      '16.08.2025, 09:00 - Onur: first',
      '17.08.2025, 22:30 - Tugce: last',
    ].join('\n');
    const result = parseWhatsAppExport(text);
    expect(new Date(result.firstAt!).toISOString()).toBe('2025-08-16T09:00:00.000Z');
    expect(new Date(result.lastAt!).toISOString()).toBe('2025-08-17T22:30:00.000Z');
    expect(result.participants).toEqual(['Onur', 'Tugce']);
  });

  it('names the chat from the participants when there is no filename', () => {
    const result = parseWhatsAppExport('16.08.2025, 09:00 - Onur: x\n16.08.2025, 09:01 - Tugce: y');
    expect(result.chatName).toBe('Onur & Tugce');
  });

  it('returns a clear warning for a file that is not a chat export', () => {
    const result = parseWhatsAppExport('just some random text\nwith no timestamps');
    expect(result.messages).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/No WhatsApp messages found/);
  });

  it('handles an empty file', () => {
    const result = parseWhatsAppExport('');
    expect(result.messages).toHaveLength(0);
    expect(result.firstAt).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const result = parseWhatsAppExport('16.08.2025, 14:03 - A: hi\r\n16.08.2025, 14:04 - B: yo\r\n');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]!.body).toBe('hi');
  });

  it('drops lines with an impossible timestamp instead of crashing', () => {
    const result = parseWhatsAppExport('16.99.2025, 14:03 - A: bad month\n16.08.2025, 14:04 - A: fine');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.body).toBe('fine');
    expect(result.warnings.join(' ')).toMatch(/unreadable timestamp/);
  });
});

describe('chatNameFromFilename', () => {
  it('reads the usual export filenames', () => {
    expect(chatNameFromFilename('WhatsApp Chat with Tugce.txt')).toBe('Tugce');
    expect(chatNameFromFilename('WhatsApp Chat - Ev 🏠.txt')).toBe('Ev 🏠');
    expect(chatNameFromFilename('WhatsApp Sohbeti - Ev.txt')).toBe('Ev');
    expect(chatNameFromFilename('WhatsApp Chat mit Tugce.txt')).toBe('Tugce');
  });

  it('returns null for the anonymous iOS "_chat.txt"', () => {
    expect(chatNameFromFilename('_chat.txt')).toBeNull();
  });
});

describe('stableHash', () => {
  it('is deterministic and reasonably collision-resistant', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'));
    expect(stableHash('abc')).not.toBe(stableHash('abd'));

    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) seen.add(stableHash(`message number ${i}`));
    expect(seen.size).toBe(20_000);
  });
});
