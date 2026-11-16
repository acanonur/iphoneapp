import { randomUUID } from 'node:crypto';
import type {
  CallOutcome,
  CallProvider,
  Language,
  SecretaryTask,
  StartCallResult,
  TaskUpdateHandler,
  TranscriptLine,
} from '../types.js';
import { disclosureLine, greetingLine } from '../prompt.js';

/** How long each stage of a simulated call takes, in milliseconds of real time. */
export interface MockTimings {
  /** Queued → dialing. */
  dialingMs: number;
  /** Queued → the other side picks up. */
  answerMs: number;
  /** Pause before a line is "spoken", plus `perCharMs` for every character of it. */
  lineMs: number;
  perCharMs: number;
  /** Last line → call ended. */
  wrapUpMs: number;
}

const REAL_TIME: MockTimings = {
  dialingMs: 1_000,
  answerMs: 3_200,
  lineMs: 700,
  perCharMs: 38,
  wrapUpMs: 1_100,
};

/** What a simulated call reports back with when no AI report writer is configured. */
interface ScriptedReport {
  summary: string;
  todo: string;
  todoWhen: string;
  outcome: CallOutcome;
  /** Inbound only: the subject line — who rang and why. */
  subject?: string;
}

const A = (text: string): TranscriptLine => ({ role: 'assistant', text });
const O = (text: string): TranscriptLine => ({ role: 'other', text });

/**
 * A call the secretary places: it asks for an appointment and gets one. The
 * conversation is a fixed one — what the user wrote is an instruction to the
 * secretary, not something to be read out to the practice.
 */
function outboundScript(task: SecretaryTask): TranscriptLine[] {
  const opening = disclosureLine(task.language, task.userName);
  switch (task.language) {
    case 'de':
      return [
        O('Praxis am Park, guten Tag.'),
        A(`${opening} Ich möchte gern einen Kontrolltermin für nächste Woche vereinbaren, am liebsten vormittags.`),
        O('Einen Moment, ich schaue in den Kalender. Dienstag um 10:30 Uhr wäre noch etwas frei.'),
        A('Dienstag um 10:30 Uhr passt sehr gut. Können Sie den Termin bitte fest eintragen?'),
        O('Ist eingetragen. Bitte bringen Sie die Versichertenkarte mit.'),
        A('Dienstag, 10:30 Uhr, mit Versichertenkarte. Vielen Dank, auf Wiederhören!'),
        O('Gern geschehen, auf Wiederhören.'),
      ];
    case 'tr':
      return [
        O('Park Polikliniği, buyurun.'),
        A(`${opening} Gelecek hafta için bir kontrol randevusu almak istiyorum, tercihen öğleden önce.`),
        O('Bir saniye, takvime bakıyorum. Salı günü saat 10.30 uygun görünüyor.'),
        A('Salı 10.30 çok uygun. Randevuyu kesinleştirebilir misiniz?'),
        O('Kaydettim. Lütfen sigorta kartınızı yanınızda getirin.'),
        A('Salı, saat 10.30, sigorta kartıyla. Çok teşekkür ederim, iyi günler!'),
        O('Rica ederim, iyi günler.'),
      ];
    case 'en':
      return [
        O('Park Street Practice, good morning.'),
        A(`${opening} I would like to book a check-up for next week, preferably in the morning.`),
        O('One moment, let me check the calendar. Tuesday at 10:30 is still free.'),
        A('Tuesday at 10:30 works very well. Could you book that in, please?'),
        O('It is booked. Please bring your insurance card.'),
        A('Tuesday, 10:30, with the insurance card. Thank you very much, goodbye!'),
        O('You are welcome, goodbye.'),
      ];
  }
}

const OUTBOUND_REPORT: Record<Language, ScriptedReport> = {
  en: {
    summary:
      'Simulated call: the office offered an appointment on Tuesday at 10:30 and it was confirmed. Please bring your insurance card.',
    todo: 'Bring your insurance card to the appointment',
    todoWhen: 'Tuesday, 10:30',
    outcome: 'achieved',
  },
  de: {
    summary:
      'Simulierter Anruf: Die Praxis hat einen Termin am Dienstag um 10:30 Uhr angeboten, und er wurde bestätigt. Bitte bringen Sie Ihre Versichertenkarte mit.',
    todo: 'Versichertenkarte zum Termin mitbringen',
    todoWhen: 'Dienstag, 10:30 Uhr',
    outcome: 'achieved',
  },
  tr: {
    summary:
      'Simüle arama: Karşı taraf salı günü saat 10.30 için randevu önerdi ve randevu onaylandı. Lütfen sigorta kartınızı yanınızda getirin.',
    todo: 'Randevuya sigorta kartınızı götürün',
    todoWhen: 'Salı, 10.30',
    outcome: 'achieved',
  },
};

/** A call the secretary answers: an office rings to move an appointment. */
function inboundScript(language: Language, ownerName: string | null): TranscriptLine[] {
  const greeting = greetingLine(language, ownerName);
  switch (language) {
    case 'de':
      return [
        A(greeting),
        O('Guten Tag, hier ist die Praxis Dr. Weber. Es geht um den Termin am Donnerstag.'),
        A('Danke. Was darf ich ausrichten?'),
        O('Der Termin am Donnerstag um 9 Uhr muss leider verschoben werden. Wir könnten Freitag um 11 Uhr anbieten.'),
        A('Verstanden: Donnerstag um 9 Uhr fällt aus, Sie bieten Freitag um 11 Uhr an. Unter welcher Nummer kann zurückgerufen werden?'),
        O('Unter 030 1234567, am besten heute bis 17 Uhr.'),
        A('030 1234567, heute bis 17 Uhr. Ich gebe das so weiter. Vielen Dank für Ihren Anruf, auf Wiederhören!'),
      ];
    case 'tr':
      return [
        A(greeting),
        O('Merhaba, Dr. Weber muayenehanesinden arıyorum. Perşembe günkü randevu hakkında.'),
        A('Teşekkürler. Ne iletmemi istersiniz?'),
        O('Perşembe saat 9’daki randevuyu maalesef ertelememiz gerekiyor. Cuma saat 11’i önerebiliriz.'),
        A('Anladım: perşembe saat 9 iptal, cuma saat 11’i öneriyorsunuz. Hangi numaradan geri aranabilirsiniz?'),
        O('030 1234567. Mümkünse bugün saat 17’ye kadar.'),
        A('030 1234567, bugün saat 17’ye kadar. Bunu ileteceğim. Aradığınız için teşekkürler, iyi günler!'),
      ];
    case 'en':
      return [
        A(greeting),
        O('Hello, this is Dr. Weber’s office. I am calling about the appointment on Thursday.'),
        A('Thank you. What message can I pass on?'),
        O('Unfortunately we have to move the appointment on Thursday at 9. We could offer Friday at 11 instead.'),
        A('Understood: Thursday at 9 is cancelled, and you offer Friday at 11. Which number should be called back?'),
        O('030 1234567, ideally today before 5 pm.'),
        A('030 1234567, today before 5 pm. I will pass that on. Thank you for calling, goodbye!'),
      ];
  }
}

const INBOUND_REPORT: Record<Language, ScriptedReport> = {
  en: {
    subject: 'Dr. Weber’s office: appointment has to move',
    summary:
      'Simulated call: Dr. Weber’s office rang. Thursday’s 9:00 appointment has to be moved; they offer Friday at 11:00 instead. Please call back on 030 1234567 today before 17:00.',
    todo: 'Call back Dr. Weber’s office on 030 1234567',
    todoWhen: 'Today, before 17:00',
    outcome: 'achieved',
  },
  de: {
    subject: 'Praxis Dr. Weber: Termin muss verschoben werden',
    summary:
      'Simulierter Anruf: Die Praxis Dr. Weber hat angerufen. Der Termin am Donnerstag um 9 Uhr muss verschoben werden; angeboten wird Freitag um 11 Uhr. Bitte rufen Sie heute bis 17 Uhr unter 030 1234567 zurück.',
    todo: 'Praxis Dr. Weber unter 030 1234567 zurückrufen',
    todoWhen: 'Heute, bis 17 Uhr',
    outcome: 'achieved',
  },
  tr: {
    subject: 'Dr. Weber muayenehanesi: randevu ertelenecek',
    summary:
      'Simüle arama: Dr. Weber muayenehanesi aradı. Perşembe saat 9.00’daki randevunun ertelenmesi gerekiyor; cuma saat 11.00’i öneriyorlar. Lütfen bugün saat 17.00’ye kadar 030 1234567 numarasını geri arayın.',
    todo: 'Dr. Weber muayenehanesini 030 1234567 numarasından geri arayın',
    todoWhen: 'Bugün, 17.00’ye kadar',
    outcome: 'achieved',
  },
};

/**
 * Simulates a full call without any external service, so the whole app can be
 * tried with no accounts and no keys. The conversation arrives line by line,
 * the way a real one does, so the live screen and its translation can be seen
 * working. Everything it produces is marked as simulated.
 */
export class MockProvider implements CallProvider {
  readonly name = 'mock';
  readonly simulated = true;
  private readonly onUpdate: TaskUpdateHandler;
  private readonly timings: MockTimings;
  /** Pending timers per task, so one call can be hung up without touching the rest. */
  private readonly timers = new Map<string, Set<NodeJS.Timeout>>();

  constructor(onUpdate: TaskUpdateHandler, pace = 1, timings: Partial<MockTimings> = {}) {
    this.onUpdate = onUpdate;
    const scaled = { ...REAL_TIME, ...timings };
    this.timings = {
      dialingMs: scaled.dialingMs * pace,
      answerMs: scaled.answerMs * pace,
      lineMs: scaled.lineMs * pace,
      perCharMs: scaled.perCharMs * pace,
      wrapUpMs: scaled.wrapUpMs * pace,
    };
  }

  /** Cancels every pending simulated event; called when the server shuts down. */
  stop(): void {
    for (const set of this.timers.values()) {
      for (const timer of set) clearTimeout(timer);
    }
    this.timers.clear();
  }

  private cancel(taskId: string): void {
    const set = this.timers.get(taskId);
    if (!set) return;
    for (const timer of set) clearTimeout(timer);
    this.timers.delete(taskId);
  }

  private schedule(taskId: string, ms: number, fn: () => void): void {
    const set = this.timers.get(taskId) ?? new Set<NodeJS.Timeout>();
    this.timers.set(taskId, set);
    const timer = setTimeout(() => {
      set.delete(timer);
      if (set.size === 0) this.timers.delete(taskId);
      fn();
    }, ms);
    // Don't keep the process alive just for simulated calls.
    timer.unref();
    set.add(timer);
  }

  /** Feeds the script in one line at a time, then ends the call with its report. */
  private play(
    taskId: string,
    startMs: number,
    script: TranscriptLine[],
    report: ScriptedReport,
  ): void {
    let at = startMs;
    script.forEach((line, index) => {
      at += this.timings.lineMs + this.timings.perCharMs * line.text.length;
      this.schedule(taskId, at, () =>
        this.onUpdate(taskId, { lines: script.slice(0, index + 1) }),
      );
    });
    this.schedule(taskId, at + this.timings.wrapUpMs, () =>
      this.onUpdate(taskId, {
        status: 'completed',
        lines: script,
        summary: report.summary,
        summarySource: 'script',
        todo: report.todo,
        todoWhen: report.todoWhen,
        outcome: report.outcome,
        ...(report.subject ? { goal: report.subject } : {}),
      }),
    );
  }

  async startCall(task: SecretaryTask): Promise<StartCallResult> {
    this.schedule(task.id, this.timings.dialingMs, () =>
      this.onUpdate(task.id, { status: 'dialing' }),
    );
    this.schedule(task.id, this.timings.answerMs, () =>
      this.onUpdate(task.id, { status: 'in_progress' }),
    );
    this.play(
      task.id,
      this.timings.answerMs,
      outboundScript(task),
      OUTBOUND_REPORT[task.summaryLanguage],
    );
    return { providerCallId: `mock_${randomUUID()}` };
  }

  /**
   * Plays a call that the secretary answers. The task already exists and is
   * `in_progress`; `callerLanguage` is the language the caller speaks.
   */
  playInbound(task: SecretaryTask, callerLanguage: Language): void {
    this.play(
      task.id,
      0,
      inboundScript(callerLanguage, task.userName),
      INBOUND_REPORT[task.summaryLanguage],
    );
  }

  async stopCall(task: SecretaryTask): Promise<void> {
    this.cancel(task.id);
  }
}
