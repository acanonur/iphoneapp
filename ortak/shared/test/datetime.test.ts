import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '../src/datetime.js';

/** Saturday 16 August 2025, 10:00 UTC. All tests run in UTC unless stated. */
const NOW = Date.UTC(2025, 7, 16, 10, 0, 0);

function parse(input: string, opts: Parameters<typeof parseQuickAdd>[1] = {}) {
  return parseQuickAdd(input, { now: NOW, utcOffsetMinutes: 0, ...opts });
}

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

describe('parseQuickAdd — times', () => {
  it('reads a 24-hour time', () => {
    const r = parse('team sync 14:30');
    expect(iso(r.startsAt)).toBe('2025-08-16T14:30:00.000Z');
    expect(iso(r.endsAt)).toBe('2025-08-16T15:30:00.000Z');
    expect(r.title).toBe('team sync');
    expect(r.allDay).toBe(false);
  });

  it('reads am/pm', () => {
    expect(iso(parse('dinner 8pm').startsAt)).toBe('2025-08-16T20:00:00.000Z');
    expect(iso(parse('dinner 8 pm').startsAt)).toBe('2025-08-16T20:00:00.000Z');
    expect(iso(parse('standup 9:15am').startsAt)).toBe('2025-08-17T09:15:00.000Z');
  });

  it('rolls a time that has already passed today over to tomorrow', () => {
    // 08:00 is behind the 10:00 reference point.
    expect(iso(parse('gym 8:00').startsAt)).toBe('2025-08-17T08:00:00.000Z');
    expect(iso(parse('gym 14:00').startsAt)).toBe('2025-08-16T14:00:00.000Z');
  });

  it('reads an explicit range', () => {
    const r = parse('workshop 19:00-21:00');
    expect(iso(r.startsAt)).toBe('2025-08-16T19:00:00.000Z');
    expect(iso(r.endsAt)).toBe('2025-08-16T21:00:00.000Z');
    expect(r.title).toBe('workshop');
  });

  it('applies a trailing meridiem to both ends of a range', () => {
    const r = parse('movie 8-10pm');
    expect(iso(r.startsAt)).toBe('2025-08-16T20:00:00.000Z');
    expect(iso(r.endsAt)).toBe('2025-08-16T22:00:00.000Z');
  });

  it('reads "from X to Y"', () => {
    const r = parse('call from 15:00 to 16:30');
    expect(iso(r.startsAt)).toBe('2025-08-16T15:00:00.000Z');
    expect(iso(r.endsAt)).toBe('2025-08-16T16:30:00.000Z');
  });

  it('handles a range that crosses midnight', () => {
    const r = parse('party 22:00-01:00');
    expect(iso(r.startsAt)).toBe('2025-08-16T22:00:00.000Z');
    expect(iso(r.endsAt)).toBe('2025-08-17T01:00:00.000Z');
  });

  it('applies an explicit duration', () => {
    expect(iso(parse('yoga 18:00 for 90 min').endsAt)).toBe('2025-08-16T19:30:00.000Z');
    expect(iso(parse('deep work 14:00 for 2 hours').endsAt)).toBe('2025-08-16T16:00:00.000Z');
  });

  it('understands vague parts of the day', () => {
    expect(iso(parse('call mum tomorrow evening').startsAt)).toBe('2025-08-17T19:00:00.000Z');
    expect(iso(parse('brunch tomorrow morning').startsAt)).toBe('2025-08-17T09:00:00.000Z');
  });
});

describe('parseQuickAdd — dates', () => {
  it('reads relative days', () => {
    expect(iso(parse('dentist tomorrow 09:00').startsAt)).toBe('2025-08-17T09:00:00.000Z');
    expect(iso(parse('dentist today 15:00').startsAt)).toBe('2025-08-16T15:00:00.000Z');
    expect(iso(parse('dentist day after tomorrow 15:00').startsAt)).toBe('2025-08-18T15:00:00.000Z');
  });

  it('reads a bare weekday as the next one coming up', () => {
    // Reference day is a Saturday; the coming Wednesday is the 20th.
    expect(iso(parse('dentist wednesday 15:00').startsAt)).toBe('2025-08-20T15:00:00.000Z');
  });

  it('treats "next <weekday>" as the following week', () => {
    expect(iso(parse('dentist next wednesday 15:00').startsAt)).toBe('2025-08-27T15:00:00.000Z');
  });

  it('reads numeric dates day-first by default', () => {
    expect(iso(parse('trip 20.08 10:00').startsAt)).toBe('2025-08-20T10:00:00.000Z');
    expect(iso(parse('trip 20/08/2025 10:00').startsAt)).toBe('2025-08-20T10:00:00.000Z');
  });

  it('infers month-first when the day component proves it', () => {
    expect(iso(parse('trip 8/20 10:00').startsAt)).toBe('2025-08-20T10:00:00.000Z');
  });

  it('honours an explicit month-first preference', () => {
    expect(iso(parse('trip 12/09 10:00', { dateOrder: 'mdy' }).startsAt)).toBe('2025-12-09T10:00:00.000Z');
    expect(iso(parse('trip 12/09 10:00', { dateOrder: 'dmy' }).startsAt)).toBe('2025-09-12T10:00:00.000Z');
  });

  it('reads ISO dates', () => {
    expect(iso(parse('trip 2026-01-05 10:00').startsAt)).toBe('2026-01-05T10:00:00.000Z');
  });

  it('rolls a bare day/month that already passed into next year', () => {
    expect(iso(parse('birthday 03.02 12:00').startsAt)).toBe('2026-02-03T12:00:00.000Z');
  });

  it('reads month names in all three languages', () => {
    expect(iso(parse('trip 20 august 10:00').startsAt)).toBe('2025-08-20T10:00:00.000Z');
    expect(iso(parse('trip august 20 10:00').startsAt)).toBe('2025-08-20T10:00:00.000Z');
    expect(iso(parse('tatil 20 ağustos 10:00').startsAt)).toBe('2025-08-20T10:00:00.000Z');
    expect(iso(parse('urlaub 20. august 10:00').startsAt)).toBe('2025-08-20T10:00:00.000Z');
  });

  it('reads a month name with an explicit year', () => {
    expect(iso(parse('wedding 12 june 2026 14:00').startsAt)).toBe('2026-06-12T14:00:00.000Z');
  });

  it('makes a date with no time an all-day event', () => {
    const r = parse('Tugce birthday 20.08');
    expect(r.allDay).toBe(true);
    expect(iso(r.startsAt)).toBe('2025-08-20T00:00:00.000Z');
    expect(iso(r.endsAt)).toBe('2025-08-21T00:00:00.000Z');
    expect(r.title).toBe('Tugce birthday');
  });
});

describe('parseQuickAdd — Turkish and German', () => {
  it('parses Turkish', () => {
    const r = parse('yarın 19:00 diş hekimi');
    expect(iso(r.startsAt)).toBe('2025-08-17T19:00:00.000Z');
    expect(r.title).toBe('diş hekimi');
  });

  it('parses a Turkish weekday with "gelecek"', () => {
    expect(iso(parse('gelecek çarşamba 15:00 toplantı').startsAt)).toBe('2025-08-27T15:00:00.000Z');
  });

  it('parses a Turkish time suffix', () => {
    expect(iso(parse('toplantı saat 14:00').startsAt)).toBe('2025-08-16T14:00:00.000Z');
    expect(iso(parse("toplantı 14:00'te").startsAt)).toBe('2025-08-16T14:00:00.000Z');
  });

  it('parses Turkish durations', () => {
    expect(iso(parse('spor 18:00 2 saat').endsAt)).toBe('2025-08-16T20:00:00.000Z');
  });

  it('parses German', () => {
    const r = parse('morgen 19:00 Zahnarzt');
    expect(iso(r.startsAt)).toBe('2025-08-17T19:00:00.000Z');
    expect(r.title).toBe('Zahnarzt');
  });

  it('parses "übermorgen" and German weekdays', () => {
    expect(iso(parse('übermorgen 10:00 Termin').startsAt)).toBe('2025-08-18T10:00:00.000Z');
    expect(iso(parse('nächsten mittwoch 15:00 Termin').startsAt)).toBe('2025-08-27T15:00:00.000Z');
  });

  it('parses German durations', () => {
    expect(iso(parse('Sport 18:00 für 2 Stunden').endsAt)).toBe('2025-08-16T20:00:00.000Z');
  });
});

describe('parseQuickAdd — titles and locations', () => {
  it('strips every matched span out of the title', () => {
    const r = parse('dinner with Tugce friday 8pm @ Mama Trattoria');
    expect(r.title).toBe('dinner with Tugce');
    expect(r.location).toBe('Mama Trattoria');
    expect(iso(r.startsAt)).toBe('2025-08-22T20:00:00.000Z');
  });

  it('reads a capitalised trailing "at <place>"', () => {
    const r = parse('coffee 15:00 at Bonanza Coffee');
    expect(r.location).toBe('Bonanza Coffee');
    expect(r.title).toBe('coffee');
  });

  it('does not mistake "at <time>" for a location', () => {
    const r = parse('standup at 9:30');
    expect(r.location).toBeNull();
    expect(r.title).toBe('standup');
    expect(iso(r.startsAt)).toBe('2025-08-17T09:30:00.000Z');
  });

  it('keeps the whole text as the title when nothing parses', () => {
    const r = parse('remember to call the landlord');
    expect(r.title).toBe('remember to call the landlord');
    expect(r.startsAt).toBeNull();
    expect(r.confidence).toBe('none');
  });

  it('reports confidence', () => {
    expect(parse('meeting 20.08 14:00').confidence).toBe('high');
    expect(parse('meeting 14:00').confidence).toBe('low');
    expect(parse('meeting').confidence).toBe('none');
  });

  it('exposes the matched spans for highlighting', () => {
    const kinds = parse('dinner tomorrow 20:00 @ Home').matched.map((m) => m.kind);
    expect(kinds).toContain('relative-day');
    expect(kinds).toContain('time');
    expect(kinds).toContain('location');
  });

  it('handles empty input', () => {
    const r = parse('   ');
    expect(r.title).toBe('');
    expect(r.startsAt).toBeNull();
  });
});

describe('parseQuickAdd — timezone handling', () => {
  it('interprets wall-clock times in the caller timezone', () => {
    // 20:00 in UTC+2 is 18:00 UTC.
    const r = parseQuickAdd('dinner 20:00', { now: NOW, utcOffsetMinutes: 120 });
    expect(iso(r.startsAt)).toBe('2025-08-16T18:00:00.000Z');
  });

  it('anchors all-day events to local midnight', () => {
    const r = parseQuickAdd('holiday 20.08', { now: NOW, utcOffsetMinutes: 120 });
    expect(iso(r.startsAt)).toBe('2025-08-19T22:00:00.000Z'); // 00:00 on the 20th in UTC+2
  });

  it('resolves "tomorrow" against the local date, not the UTC one', () => {
    // 23:30 UTC on the 16th is 01:30 on the 17th in UTC+2, so "tomorrow" is the 18th.
    const lateNight = Date.UTC(2025, 7, 16, 23, 30);
    const r = parseQuickAdd('dentist tomorrow 09:00', { now: lateNight, utcOffsetMinutes: 120 });
    expect(iso(r.startsAt)).toBe('2025-08-18T07:00:00.000Z'); // 09:00 on the 18th in UTC+2
  });
});
