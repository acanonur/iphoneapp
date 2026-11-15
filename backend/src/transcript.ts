import type { CallDirection, Language, TranscriptLine } from './types.js';

/**
 * How the two sides of a call are named in the plain-text transcript — the one
 * that is shared, searched and handed to the report writer. The app does not
 * parse these labels; it renders `lines` and names the speakers itself.
 */
const ASSISTANT_LABEL: Record<Language, string> = {
  de: 'KI-Assistent',
  en: 'AI assistant',
  tr: 'Yapay zekâ asistanı',
};

const OTHER_LABEL: Record<CallDirection, Record<Language, string>> = {
  outbound: { de: 'Gesprächspartner', en: 'Other party', tr: 'Karşı taraf' },
  inbound: { de: 'Anrufer', en: 'Caller', tr: 'Arayan' },
};

export function speakerLabel(
  role: TranscriptLine['role'],
  language: Language,
  direction: CallDirection,
): string {
  return role === 'assistant' ? ASSISTANT_LABEL[language] : OTHER_LABEL[direction][language];
}

/** Flattens the turns of a call into "Speaker: words" lines. */
export function linesToText(
  lines: TranscriptLine[],
  language: Language,
  direction: CallDirection,
): string {
  return lines
    .map((line) => `${speakerLabel(line.role, language, direction)}: ${line.text}`)
    .join('\n');
}

/** Labels a voice provider (or an older version of this backend) uses for the AI side. */
const ASSISTANT_SPEAKERS = new Set([
  'agent',
  'assistant',
  'ai',
  'ai assistant',
  'ki-assistent',
  'ki assistent',
  'yapay zeka asistanı',
  'yapay zekâ asistanı',
  'secretary',
  'bot',
]);

/** A speaker label never contains a digit, so "… um 10:30 Uhr" is not mistaken for one. */
const SPEAKER_PREFIX = /^([^\d:\n]{1,40}):(?:\s+|$)(.*)$/;

/**
 * Reads a flat "Agent: … / User: …" transcript back into turns. Used only when
 * a provider sends no structured transcript. A line without a speaker prefix
 * continues the previous turn.
 */
export function textToLines(transcript: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (const raw of transcript.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const match = SPEAKER_PREFIX.exec(trimmed);
    const speaker = match?.[1]?.trim().toLowerCase();
    const words = match?.[2]?.trim();
    if (match && speaker !== undefined && words !== undefined) {
      const role = ASSISTANT_SPEAKERS.has(speaker) ? 'assistant' : 'other';
      if (words) lines.push({ role, text: words });
      continue;
    }
    const previous = lines[lines.length - 1];
    if (previous) {
      previous.text = `${previous.text} ${trimmed}`;
    } else {
      lines.push({ role: 'other', text: trimmed });
    }
  }
  return lines;
}

/** Merges consecutive turns by the same speaker, and drops empty ones. */
export function tidyLines(lines: TranscriptLine[]): TranscriptLine[] {
  const tidy: TranscriptLine[] = [];
  for (const line of lines) {
    const words = line.text.replace(/\s+/g, ' ').trim();
    if (!words) continue;
    const previous = tidy[tidy.length - 1];
    if (previous && previous.role === line.role) {
      previous.text = `${previous.text} ${words}`;
    } else {
      tidy.push({ role: line.role, text: words });
    }
  }
  return tidy;
}

/** Total characters spoken — how "long" a transcript is, for never-go-backwards checks. */
export function spokenLength(lines: TranscriptLine[]): number {
  return lines.reduce((sum, line) => sum + line.text.length, 0);
}
