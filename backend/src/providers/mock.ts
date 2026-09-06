import { randomUUID } from 'node:crypto';
import type {
  CallProvider,
  SecretaryTask,
  TaskUpdateHandler,
  Language,
  StartCallResult,
} from '../types.js';
import { disclosureLine } from '../prompt.js';

export interface MockDelays {
  dialingMs: number;
  inProgressMs: number;
  completedMs: number;
}

const DEFAULT_DELAYS: MockDelays = {
  dialingMs: 1_000,
  inProgressMs: 3_000,
  completedMs: 9_000,
};

function fakeTranscript(task: SecretaryTask): string {
  const ai = disclosureLine(task.language, task.userName);
  const lines: Record<Language, string[]> = {
    de: [
      `KI-Assistent: ${ai} Ich rufe an, weil: ${task.goal}`,
      'Empfang: Guten Tag, wie kann ich helfen?',
      'KI-Assistent: Wäre dafür ein Termin nächste Woche möglich?',
      'Empfang: Ja, Dienstag um 10:30 Uhr hätten wir etwas frei.',
      'KI-Assistent: Dienstag 10:30 Uhr passt sehr gut. Ich bestätige den Termin.',
      'Empfang: In Ordnung, der Termin ist eingetragen. Bitte Versichertenkarte mitbringen.',
      'KI-Assistent: Vielen Dank, das war alles. Auf Wiederhören!',
    ],
    en: [
      `AI assistant: ${ai} I am calling because: ${task.goal}`,
      'Receptionist: Hi, how can I help?',
      'AI assistant: Would an appointment next week be possible?',
      'Receptionist: Yes, Tuesday at 10:30 am is available.',
      'AI assistant: Tuesday 10:30 am works well. Please book it.',
      'Receptionist: Done, the appointment is booked. Please bring an ID.',
      'AI assistant: Thank you very much, that is all. Goodbye!',
    ],
    tr: [
      `Yapay zeka asistanı: ${ai} Arama nedenim: ${task.goal}`,
      'Resepsiyon: Merhaba, nasıl yardımcı olabilirim?',
      'Yapay zeka asistanı: Önümüzdeki hafta için bir randevu mümkün mü?',
      'Resepsiyon: Evet, salı günü saat 10:30 uygun.',
      'Yapay zeka asistanı: Salı 10:30 çok uygun. Randevuyu onaylıyorum.',
      'Resepsiyon: Tamamdır, randevunuz alındı. Lütfen kimliğinizi getirin.',
      'Yapay zeka asistanı: Çok teşekkürler, hepsi bu kadar. İyi günler!',
    ],
  };
  return lines[task.language].join('\n');
}

/**
 * Simulates a full call lifecycle without any external service, so the app
 * can be developed and demoed with zero API keys.
 */
export class MockProvider implements CallProvider {
  readonly name = 'mock';
  private readonly onUpdate: TaskUpdateHandler;
  private readonly delays: MockDelays;
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(onUpdate: TaskUpdateHandler, delays: Partial<MockDelays> = {}) {
    this.onUpdate = onUpdate;
    this.delays = { ...DEFAULT_DELAYS, ...delays };
  }

  /** Cancels pending simulated events; called when the app shuts down. */
  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  async startCall(task: SecretaryTask): Promise<StartCallResult> {
    const providerCallId = `mock_${randomUUID()}`;
    const schedule = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        fn();
      }, ms);
      // Don't keep the process alive just for simulated calls.
      t.unref();
      this.timers.add(t);
    };

    schedule(this.delays.dialingMs, () =>
      this.onUpdate(task.id, { status: 'dialing' }),
    );
    schedule(this.delays.inProgressMs, () =>
      this.onUpdate(task.id, { status: 'in_progress' }),
    );
    schedule(this.delays.completedMs, () =>
      this.onUpdate(task.id, {
        status: 'completed',
        transcript: fakeTranscript(task),
      }),
    );

    return { providerCallId };
  }
}
