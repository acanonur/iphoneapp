import type { ClaudeSettings } from './claude.js';
import type { Config } from './config.js';
import type { TaskStore } from './db.js';
import { buildInboundVariables } from './prompt.js';
import {
  ANSWERED_CALLS_KEPT_DAYS,
  callDurationSeconds,
  classifyEnding,
  describeError,
  linesFromCall,
  type RetellCall,
  type RetellProvider,
  type RetellWebhookBody,
} from './providers/retell.js';
import {
  answeredFallbackSummary,
  fallbackSummary,
  noMessageSummary,
  summarizeAnsweredCall,
  summarizeCall,
} from './summarizer.js';
import { newTask } from './tasks.js';
import { linesToText, spokenLength, tidyLines } from './transcript.js';
import {
  ACTIVE_CALL_STATUSES,
  TERMINAL_STATUSES,
  type SecretaryTask,
  type TranscriptLine,
} from './types.js';

export interface EngineLog {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** How long after a call ends its data is removed at the provider, if nothing else triggers it. */
const CLEANUP_DELAY_MS = 120_000;
/** How often calls are checked against the provider. */
const POLL_TICK_MS = 5_000;
/** With webhooks arriving, a call is only looked up after this much silence. */
const QUIET_BEFORE_POLL_MS = 90_000;
const POLL_INTERVAL_WITH_WEBHOOKS_MS = 30_000;
const POLL_INTERVAL_WITHOUT_WEBHOOKS_MS = 5_000;
/** How often the provider is asked for answered calls this server has not heard of. */
const LOOK_INTERVAL_MS = 120_000;
/** ... and how soon again when somebody has the app open. */
const LOOK_AGAIN_AFTER_MS = 45_000;
/** After answering is switched off, a call that was under way may still end. */
const LOOK_ON_AFTER_OFF_MS = 20 * 60_000;
/** A call that ended this recently is still being summarised at the provider. */
const ANALYSIS_TAKES_MS = 30_000;
/** When to ask for the provider's summary of a call that ended without one. */
const ANALYSIS_DELAYS_MS = [5_000, 12_000, 25_000, 45_000];
const DAY_MS = 86_400_000;
const ENDED_STATUSES = ['ended', 'error', 'not_connected'];

function secondsSince(isoTimestamp: string): number {
  const started = Date.parse(isoTimestamp);
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.round((Date.now() - started) / 1000));
}

function otherPartySpoke(lines: TranscriptLine[]): boolean {
  return lines.some((line) => line.role === 'other');
}

/**
 * Everything that happens to a call after it has been started: the state
 * changes the provider reports, the transcript as it grows, the report at the
 * end, and the housekeeping around it. The HTTP routes and the provider both
 * talk to this, so a webhook, a poll and the simulator all take the same path.
 */
export class CallEngine {
  /** Set once the server knows its public address (a tunnel may come up late). */
  publicBaseUrl: string | null;

  private readonly store: TaskStore;
  private readonly config: Config;
  private readonly log: EngineLog;
  private readonly claude: ClaudeSettings | null;
  private readonly webhookSecret: string;
  private retell: RetellProvider | null = null;

  private readonly finalizing = new Set<string>();
  private readonly answeredAt = new Map<string, number>();
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();
  private readonly cleaned = new Set<string>();
  private readonly lastPolled = new Map<string, number>();
  private readonly polling = new Set<string>();
  private readonly warnedShapes = new Set<string>();
  private readonly analysisTimers = new Set<NodeJS.Timeout>();
  private readonly analysisDelaysMs: number[];
  private lookFailed = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private lookTimer: NodeJS.Timeout | null = null;
  private looking = false;
  private lastLook = 0;
  private answeringOffSince = 0;
  private stopped = false;

  /** Told whenever a task moves on — for the line a person reads in the server's window. */
  private readonly onProgress: ((task: SecretaryTask) => void) | null;

  constructor(deps: {
    store: TaskStore;
    config: Config;
    log: EngineLog;
    claude: ClaudeSettings | null;
    webhookSecret: string;
    onProgress?: (task: SecretaryTask) => void;
    /** When to ask for a finished call's summary; shortened by tests. */
    analysisDelaysMs?: number[];
  }) {
    this.store = deps.store;
    this.config = deps.config;
    this.log = deps.log;
    this.onProgress = deps.onProgress ?? null;
    this.analysisDelaysMs = deps.analysisDelaysMs ?? ANALYSIS_DELAYS_MS;
    this.claude = deps.claude;
    this.webhookSecret = deps.webhookSecret;
    this.publicBaseUrl = deps.config.publicBaseUrl;
  }

  /** Where the voice provider should deliver events, or null if it cannot reach us. */
  webhookUrl(): string | null {
    return this.publicBaseUrl
      ? `${this.publicBaseUrl}/webhooks/retell/${this.webhookSecret}`
      : null;
  }

  useRetell(provider: RetellProvider): void {
    this.retell = provider;
  }

  // MARK: - State changes

  /**
   * The one place a task's state changes, whoever reports it. Guards the
   * invariants: a finished task stays finished, and a transcript only grows.
   */
  applyUpdate = (taskId: string, patch: Partial<SecretaryTask>): void => {
    const current = this.store.get(taskId);
    if (!current) return;

    const effective: Partial<SecretaryTask> = { ...patch };
    const wasTerminal = TERMINAL_STATUSES.includes(current.status);
    if (wasTerminal) {
      // Never let a late or out-of-order event reopen a finished task, or
      // rewrite the record its report was written from.
      if (effective.status && effective.status !== current.status) return;
      delete effective.lines;
    }

    if (effective.lines) {
      const tidy = tidyLines(effective.lines);
      if (spokenLength(tidy) < spokenLength(current.lines)) {
        delete effective.lines;
      } else {
        effective.lines = tidy;
        if (tidy.length > 0) {
          effective.transcript = linesToText(tidy, current.language, current.direction);
        }
      }
    }

    if (current.kind === 'call') {
      if (effective.status === 'in_progress' && current.status !== 'in_progress') {
        this.answeredAt.set(taskId, Date.now());
      }
      if (
        effective.status === 'completed' &&
        current.durationSeconds == null &&
        effective.durationSeconds == null
      ) {
        const answered = this.answeredAt.get(taskId);
        effective.durationSeconds = answered
          ? Math.max(0, Math.round((Date.now() - answered) / 1000))
          : secondsSince(current.createdAt);
      }
      if (effective.status === 'completed' || effective.status === 'failed') {
        this.answeredAt.delete(taskId);
        this.lastPolled.delete(taskId);
      }
    }

    const updated = this.store.update(taskId, effective);
    if (!updated) return;
    if (updated.status !== current.status) this.onProgress?.(updated);
    if (!wasTerminal && updated.status === 'completed' && updated.kind === 'call') {
      void this.finalizeCall(updated.id);
    }
  };

  /** Writes the user-facing report once a call has ended. */
  async finalizeCall(taskId: string): Promise<void> {
    if (this.finalizing.has(taskId)) return;
    this.finalizing.add(taskId);
    try {
      const task = this.store.get(taskId);
      if (!task || task.summarySource === 'claude') return;
      const inbound = task.direction === 'inbound';

      // Someone rang and hung up before saying anything: there is nothing to
      // summarise, but the user should still see that they were called.
      if (inbound && !otherPartySpoke(task.lines)) {
        this.store.update(taskId, {
          summary: noMessageSummary(task.summaryLanguage),
          summarySource: 'placeholder',
          outcome: 'no_answer',
        });
        return;
      }

      if (this.claude && task.lines.length > 0) {
        if (inbound) {
          const note = await summarizeAnsweredCall(this.claude, task);
          if (note) {
            this.store.update(taskId, {
              summary: note.summary,
              summarySource: 'claude',
              goal: note.subject || task.goal,
              todo: note.todo,
              todoWhen: note.todoWhen,
              outcome: note.messageTaken ? 'achieved' : 'no_answer',
            });
            return;
          }
        } else {
          const report = await summarizeCall(this.claude, task);
          if (report) {
            this.store.update(taskId, {
              summary: report.summary,
              summarySource: 'claude',
              outcome: report.outcome,
              todo: report.todo,
              todoWhen: report.todoWhen,
            });
            return;
          }
        }
      }

      // No report writer, or it failed. Keep a summary that came from the
      // provider or the simulator; otherwise say plainly that there is none.
      const fresh = this.store.get(taskId);
      if (!fresh) return;
      if (fresh.summary && fresh.summarySource !== 'placeholder') return;
      this.store.update(taskId, {
        summary: inbound
          ? answeredFallbackSummary(fresh.summaryLanguage)
          : fallbackSummary(fresh.summaryLanguage),
        summarySource: 'placeholder',
        outcome: fresh.outcome ?? 'unknown',
      });
    } finally {
      this.finalizing.delete(taskId);
    }
  }

  // MARK: - Provider events

  /**
   * Handles one webhook delivery. Returns what to answer with: Retell expects
   * a reply only to `call_inbound`, where the reply shapes the call.
   */
  handleWebhook(body: RetellWebhookBody | null | undefined): Record<string, unknown> {
    if (body?.event === 'call_inbound' || body?.call_inbound) {
      return this.inboundReply();
    }

    const call = body?.call ?? body?.data;
    const event = body?.event ?? '';
    if (!call?.call_id) {
      this.warnOnce(`shape:${event}`, `Webhook "${event}" carried no call object; ignored`);
      return { ok: true, ignored: true };
    }

    const task = this.taskFor(call);
    if (!task) {
      this.warnOnce(`unknown:${call.call_id}`, `Webhook for a call this server does not know (${call.call_id})`);
      return { ok: true, ignored: true };
    }

    switch (event) {
      case 'call_started':
        this.onCallStarted(task);
        break;
      case 'transcript_updated':
        this.onTranscript(task, call);
        break;
      case 'call_ended':
        this.onCallEnded(task, call);
        break;
      case 'call_analyzed':
        this.onCallAnalyzed(task, call);
        break;
      default:
        break;
    }
    return { ok: true };
  }

  /** The task a provider call belongs to; an unknown incoming call gets a new one. */
  private taskFor(call: RetellCall): SecretaryTask | undefined {
    const callId = call.call_id;
    if (!callId) return undefined;

    const claimed = call.metadata?.task_id ? this.store.get(call.metadata.task_id) : undefined;
    if (claimed) {
      if (claimed.providerCallId && claimed.providerCallId !== callId) {
        // The event names one of our tasks but a different call: not ours to apply.
        this.log.warn(`Webhook call ${callId} does not match task ${claimed.id}; ignored`);
        return undefined;
      }
      if (!claimed.providerCallId) this.store.update(claimed.id, { providerCallId: callId });
      return claimed;
    }

    const known = this.store.findByProviderCallId(callId);
    if (known) return known;
    if (call.direction !== 'inbound') return undefined;

    const owner = this.store.inboundOwner();
    // A call that is only heard of later is filed under the time it came in.
    const rang =
      typeof call.start_timestamp === 'number' && call.start_timestamp > 0
        ? new Date(Math.min(call.start_timestamp, Date.now())).toISOString()
        : null;
    const task = newTask({
      ...(rang ? { createdAt: rang, updatedAt: rang } : {}),
      deviceId: owner?.deviceId ?? 'unassigned',
      kind: 'call',
      direction: 'inbound',
      goal: '',
      phoneNumber: typeof call.from_number === 'string' ? call.from_number.slice(0, 32) : null,
      // Expected to be in the language callers speak; reported in the owner's.
      language: owner?.callLanguage ?? owner?.language ?? 'en',
      summaryLanguage: owner?.language ?? 'en',
      userName: owner?.name ?? null,
      status: 'in_progress',
      providerCallId: callId,
    });
    this.store.create(task);
    this.answeredAt.set(task.id, Date.now());
    this.onProgress?.(task);
    return task;
  }

  private onCallStarted(task: SecretaryTask): void {
    const fresh = this.store.get(task.id);
    if (fresh && (fresh.status === 'queued' || fresh.status === 'dialing')) {
      this.applyUpdate(task.id, { status: 'in_progress' });
    }
  }

  private onTranscript(task: SecretaryTask, call: RetellCall): void {
    const fresh = this.store.get(task.id);
    if (!fresh || TERMINAL_STATUSES.includes(fresh.status)) return;
    const lines = linesFromCall(call);
    if (lines.length === 0) return;
    // Words are being exchanged, so the call is connected whatever we were told.
    const connected = fresh.status === 'queued' || fresh.status === 'dialing';
    this.applyUpdate(task.id, { lines, ...(connected ? { status: 'in_progress' } : {}) });
  }

  private onCallEnded(task: SecretaryTask, call: RetellCall): void {
    const fresh = this.store.get(task.id);
    if (!fresh) return;
    if (call.call_id) this.scheduleCleanup(call.call_id);
    // A repeated delivery, or a call the user already ended.
    if (TERMINAL_STATUSES.includes(fresh.status)) return;

    const reported = linesFromCall(call);
    const lines = spokenLength(reported) >= spokenLength(fresh.lines) ? reported : fresh.lines;
    const inbound = fresh.direction === 'inbound';
    const ending = classifyEnding(call, {
      // An answered call is always worth a record, even if the caller said nothing.
      hadConversation: inbound || otherPartySpoke(lines),
      wasConnected: inbound || fresh.status === 'in_progress' || lines.length > 0,
    });
    const duration = callDurationSeconds(call);

    // The user hung up: that is why the call ended, whatever reason the line
    // gives for it. What was said is kept, and reported on if anyone spoke.
    if (fresh.errorCode === 'cancelled') {
      const spoke = otherPartySpoke(lines);
      this.applyUpdate(task.id, {
        status: spoke ? 'completed' : 'failed',
        ...(lines.length > 0 ? { lines } : {}),
        errorCode: 'cancelled',
        error: 'Ended by the user',
        ...(duration !== null && spoke ? { durationSeconds: duration } : {}),
      });
      this.awaitAnalysis(task.id, call);
      return;
    }

    this.applyUpdate(task.id, {
      status: ending.status,
      ...(lines.length > 0 ? { lines } : {}),
      errorCode: fresh.errorCode ?? ending.errorCode,
      error: ending.error,
      ...(ending.outcome ? { outcome: ending.outcome } : {}),
      ...(duration !== null && ending.status === 'completed' ? { durationSeconds: duration } : {}),
    });
    this.awaitAnalysis(task.id, call);
  }

  /**
   * The provider writes a short summary of every call a few seconds after it
   * ends, and says so in an event of its own. Where no events arrive — no
   * public address — that summary would never be seen, although it is the
   * only report there is on a server without a report writer. So it is asked
   * for, a few times, until it is there or the call has been deleted.
   */
  private awaitAnalysis(taskId: string, call: RetellCall, attempt = 0): void {
    const callId = call.call_id;
    if (!callId || !this.retell || this.stopped) return;
    if (call.call_analysis?.call_summary || attempt >= this.analysisDelaysMs.length) return;
    if (attempt === 0 && this.store.get(taskId)?.status !== 'completed') return;
    const timer = setTimeout(() => {
      this.analysisTimers.delete(timer);
      const retell = this.retell;
      const task = this.store.get(taskId);
      if (!retell || !task || this.stopped || this.cleaned.has(callId)) return;
      // The report writer has already said it better.
      if (task.summarySource === 'claude' || task.summarySource === 'provider') return;
      retell
        .getCall(callId)
        .then((latest) => {
          if (this.stopped || this.cleaned.has(callId)) return;
          if (latest.call_analysis?.call_summary) this.onCallAnalyzed(task, { ...latest, call_id: callId });
          else this.awaitAnalysis(taskId, call, attempt + 1);
        })
        .catch(() => this.awaitAnalysis(taskId, call, attempt + 1));
    }, this.analysisDelaysMs[attempt]);
    timer.unref();
    this.analysisTimers.add(timer);
  }

  private onCallAnalyzed(task: SecretaryTask, call: RetellCall): void {
    // This event carries the finished call too. If the "ended" event was lost,
    // it is the first we hear of the call being over.
    this.onCallEnded(task, call);

    const fresh = this.store.get(task.id);
    const summary = call.call_analysis?.call_summary?.trim();
    if (fresh && summary && fresh.status === 'completed') {
      // Retell's own summary stands in until, or unless, Claude writes one.
      if (fresh.summarySource === null || fresh.summarySource === 'placeholder') {
        const undecided = fresh.outcome === null || fresh.outcome === 'unknown';
        this.store.update(task.id, {
          summary,
          summarySource: 'provider',
          ...(undecided
            ? { outcome: call.call_analysis?.call_successful ? 'achieved' : 'unknown' }
            : {}),
        });
      }
    }
    // Nothing more will arrive for this call: its data can go now.
    if (call.call_id) this.runCleanup(call.call_id);
  }

  /** How an incoming call should be answered: who the secretary is answering for. */
  private inboundReply(): Record<string, unknown> {
    return {
      call_inbound: {
        dynamic_variables: buildInboundVariables(this.store.inboundOwner()),
        metadata: { direction: 'inbound' },
      },
    };
  }

  private warnOnce(key: string, message: string): void {
    if (this.warnedShapes.has(key)) return;
    if (this.warnedShapes.size > 500) this.warnedShapes.clear();
    this.warnedShapes.add(key);
    this.log.warn(message);
  }

  // MARK: - Ending a call from our side

  /**
   * Finishes a call the user hung up. Whatever was said up to then is kept,
   * and reported on if there was a conversation.
   */
  finishCancelled(taskId: string): void {
    const task = this.store.get(taskId);
    if (!task || TERMINAL_STATUSES.includes(task.status)) return;

    // A real call is not over for us the moment we ask for it to end: the
    // phone company hands the conversation over once the line is down — all
    // of it when there are no live events, the last words when there are.
    // Closing the task now would throw that away (a finished task takes no
    // more lines). So only the intent is recorded here; the ending itself
    // comes from the provider, asked for right away and a few times more.
    if (!task.simulated && this.retell && task.providerCallId) {
      this.store.update(taskId, { errorCode: 'cancelled', error: 'Ended by the user' });
      this.settleCancelled(taskId, 0);
      return;
    }
    this.closeCancelled(taskId);
  }

  /** Ends a task the user hung up, with whatever was said up to then. */
  private closeCancelled(taskId: string): void {
    const task = this.store.get(taskId);
    if (!task || TERMINAL_STATUSES.includes(task.status)) return;
    if (task.providerCallId) this.scheduleCleanup(task.providerCallId);
    this.applyUpdate(taskId, {
      status: otherPartySpoke(task.lines) ? 'completed' : 'failed',
      errorCode: 'cancelled',
      error: 'Ended by the user',
    });
  }

  /** How long to wait, each time, before asking the provider how a hung-up call ended. */
  private static readonly SETTLE_DELAYS_MS = [1_200, 2_500, 4_000, 7_000];

  private settleCancelled(taskId: string, attempt: number): void {
    const timer = setTimeout(() => {
      void this.refreshFromProvider(taskId).then(() => {
        const task = this.store.get(taskId);
        if (!task || TERMINAL_STATUSES.includes(task.status) || this.stopped) return;
        if (attempt + 1 < CallEngine.SETTLE_DELAYS_MS.length) {
          this.settleCancelled(taskId, attempt + 1);
        } else {
          // The provider never said the call was over. It was asked to end
          // it; close the task with what there is.
          this.closeCancelled(taskId);
        }
      });
    }, CallEngine.SETTLE_DELAYS_MS[attempt]);
    timer.unref();
  }

  /**
   * Brings one call up to date from the provider's record of it, now. Used
   * after a hang-up, when waiting for the next round of polling would leave
   * the app looking at a call that is already over.
   */
  async refreshFromProvider(taskId: string): Promise<void> {
    const task = this.store.get(taskId);
    const retell = this.retell;
    if (!task || !retell || !task.providerCallId || this.stopped) return;
    if (TERMINAL_STATUSES.includes(task.status) || this.polling.has(taskId)) return;
    this.polling.add(taskId);
    this.lastPolled.set(taskId, Date.now());
    try {
      const call = await retell.getCall(task.providerCallId);
      if (!this.stopped) this.applySnapshot(task, call);
    } catch (error) {
      this.log.warn(`Could not look up call ${task.providerCallId}: ${describeError(error)}`);
    } finally {
      this.polling.delete(taskId);
    }
  }

  // MARK: - Calls answered while nobody was listening

  /**
   * Fetches the calls the answering agent took that this server has not heard
   * of. Answering does not need this server: the phone company picks up
   * whether it is running or not, but can only tell it about a call while it
   * is reachable. Everything else is collected here — at start-up, every
   * couple of minutes, and when somebody opens the app.
   *
   * Returns how many calls were new.
   */
  async importAnsweredCalls(): Promise<number> {
    const retell = this.retell;
    if (!retell?.canAnswerCalls || this.stopped || this.looking) return 0;
    const justOff = Date.now() - this.answeringOffSince < LOOK_ON_AFTER_OFF_MS;
    if (!justOff && !this.store.inboundOwner()?.answerCalls) return 0;
    this.looking = true;
    this.lastLook = Date.now();
    let fresh = 0;
    try {
      const listed = await retell.listAnsweredCalls(Date.now() - ANSWERED_CALLS_KEPT_DAYS * DAY_MS);
      // Oldest first, so that they are filed in the order they came in.
      for (const entry of [...listed].reverse()) {
        if (this.stopped) break;
        const callId = entry.call_id;
        if (!callId || entry.direction !== 'inbound') continue;
        if (this.cleaned.has(callId) || this.store.findByProviderCallId(callId)) continue;
        const over = ENDED_STATUSES.includes(entry.call_status ?? '');
        // Just over: its summary is still being written over there. Next time.
        if (
          over &&
          !entry.call_analysis &&
          typeof entry.end_timestamp === 'number' &&
          Date.now() - entry.end_timestamp < ANALYSIS_TAKES_MS
        ) {
          continue;
        }
        try {
          // The listing says that a call happened; what was said is in the call itself.
          const call = { ...(await retell.getCall(callId)), call_id: callId };
          if (this.stopped) break;
          if (this.store.findByProviderCallId(callId)) continue;
          const task = this.taskFor({ ...call, direction: 'inbound' });
          if (!task) continue;
          fresh += 1;
          this.applySnapshot(task, call);
        } catch (error) {
          this.log.warn(`Could not fetch the answered call ${callId}: ${describeError(error)}`);
        }
      }
      this.lookFailed = false;
    } catch (error) {
      // Said once, not every two minutes for as long as the internet is away.
      if (!this.lookFailed) {
        this.lookFailed = true;
        this.log.warn(`Could not ask the phone service for answered calls: ${describeError(error)}`);
      }
    } finally {
      this.looking = false;
    }
    return fresh;
  }

  /**
   * Answering has just been switched off. What was taken up to now is still
   * collected — and for a while longer, for the caller who was mid-sentence.
   */
  answeringSwitchedOff(): void {
    this.answeringOffSince = Date.now();
    void this.importAnsweredCalls();
  }

  /** Somebody is looking at the list: worth asking again, but not every time. */
  lookForAnsweredCallsSoon(): void {
    if (!this.retell?.canAnswerCalls || Date.now() - this.lastLook < LOOK_AGAIN_AFTER_MS) return;
    void this.importAnsweredCalls();
  }

  // MARK: - Missed events

  /**
   * Brings a call up to date from the provider's own record of it. This is how
   * calls progress at all when the provider cannot reach this server (no public
   * address), and the safety net for a lost webhook when it can.
   */
  applySnapshot(task: SecretaryTask, call: RetellCall): void {
    switch (call.call_status) {
      case 'registered':
        if (task.status === 'queued') this.applyUpdate(task.id, { status: 'dialing' });
        break;
      case 'ongoing':
        this.onCallStarted(task);
        this.onTranscript(task, call);
        break;
      case 'ended':
      case 'error':
      case 'not_connected':
        if (call.call_analysis?.call_summary) this.onCallAnalyzed(task, call);
        else this.onCallEnded(task, call);
        break;
      default:
        break;
    }
  }

  private async pollOnce(): Promise<void> {
    const retell = this.retell;
    if (!retell || this.stopped) return;
    const now = Date.now();
    const hasWebhooks = this.publicBaseUrl !== null;
    const interval = hasWebhooks
      ? POLL_INTERVAL_WITH_WEBHOOKS_MS
      : POLL_INTERVAL_WITHOUT_WEBHOOKS_MS;
    const deadlineMs = (this.config.maxCallMinutes + 15) * 60_000;

    for (const task of this.store.listActiveCalls()) {
      if (task.simulated || !task.providerCallId || this.polling.has(task.id)) continue;
      const quietFor = now - Date.parse(task.updatedAt);
      if (hasWebhooks && quietFor < QUIET_BEFORE_POLL_MS) continue;
      if (now - (this.lastPolled.get(task.id) ?? 0) < interval) continue;

      this.polling.add(task.id);
      this.lastPolled.set(task.id, now);
      try {
        const call = await retell.getCall(task.providerCallId);
        if (!this.stopped) this.applySnapshot(task, call);
      } catch (error) {
        this.log.warn(`Could not look up call ${task.providerCallId}: ${describeError(error)}`);
        // A call nobody can tell us about, long past its time limit, is over.
        if (now - Date.parse(task.createdAt) > deadlineMs) {
          this.applyUpdate(task.id, {
            status: otherPartySpoke(task.lines) ? 'completed' : 'failed',
            errorCode: 'technical',
            error: 'Lost track of the call',
          });
        }
      } finally {
        this.polling.delete(task.id);
      }
    }
  }

  startPolling(): void {
    if (this.pollTimer || !this.retell) return;
    this.pollTimer = setInterval(() => void this.pollOnce(), POLL_TICK_MS);
    this.pollTimer.unref();
    this.lookTimer = setInterval(() => void this.importAnsweredCalls(), LOOK_INTERVAL_MS);
    this.lookTimer.unref();
  }

  /**
   * After a restart, nothing may be left hanging:
   * - a simulated call has lost its script and will never finish on its own;
   * - a real call that was still being placed has no call at the provider to
   *   ask about — it would stay "dialing" for ever;
   * - a call that ended while its report was being written would never get one.
   * Real calls that were under way are picked up again by the poller.
   */
  recoverAfterRestart(): void {
    const aMinuteAgo = Date.now() - 60_000;
    for (const task of this.store.listActiveCalls()) {
      if (task.simulated) {
        this.applyUpdate(task.id, {
          status: 'failed',
          errorCode: 'technical',
          error: 'The server restarted during the call',
        });
      } else if (!task.providerCallId && Date.parse(task.createdAt) < aMinuteAgo) {
        this.applyUpdate(task.id, {
          status: 'failed',
          errorCode: 'technical',
          error: 'The server restarted while the call was being placed',
        });
      }
    }
    for (const task of this.store.listUnreportedCalls()) {
      void this.finalizeCall(task.id);
    }
  }

  // MARK: - Housekeeping at the provider

  /** Removes the call at the provider — the recording included — after a grace period. */
  private scheduleCleanup(callId: string): void {
    if (!this.retell || !this.config.retell?.deleteAfterCall) return;
    if (this.cleaned.has(callId) || this.cleanupTimers.has(callId)) return;
    const timer = setTimeout(() => this.runCleanup(callId), CLEANUP_DELAY_MS);
    timer.unref();
    this.cleanupTimers.set(callId, timer);
  }

  private runCleanup(callId: string): void {
    const timer = this.cleanupTimers.get(callId);
    if (timer) clearTimeout(timer);
    this.cleanupTimers.delete(callId);
    const retell = this.retell;
    if (!retell || !this.config.retell?.deleteAfterCall || this.cleaned.has(callId)) return;
    if (this.cleaned.size > 5_000) this.cleaned.clear();
    this.cleaned.add(callId);
    retell.deleteCall(callId).catch((error: unknown) => {
      this.log.warn(`Could not delete call ${callId} at the provider: ${describeError(error)}`);
    });
  }

  /** True while the call can still be hung up. */
  static isActive(task: SecretaryTask): boolean {
    return task.kind === 'call' && ACTIVE_CALL_STATUSES.includes(task.status);
  }

  stop(): void {
    this.stopped = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.lookTimer) clearInterval(this.lookTimer);
    this.lookTimer = null;
    for (const timer of this.analysisTimers) clearTimeout(timer);
    this.analysisTimers.clear();
    for (const timer of this.cleanupTimers.values()) clearTimeout(timer);
    this.cleanupTimers.clear();
  }
}
