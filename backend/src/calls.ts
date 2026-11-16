import type { ClaudeSettings } from './claude.js';
import type { Config } from './config.js';
import type { TaskStore } from './db.js';
import { buildInboundVariables } from './prompt.js';
import {
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
  private pollTimer: NodeJS.Timeout | null = null;
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
  }) {
    this.store = deps.store;
    this.config = deps.config;
    this.log = deps.log;
    this.onProgress = deps.onProgress ?? null;
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
    const task = newTask({
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

    this.applyUpdate(task.id, {
      status: ending.status,
      ...(lines.length > 0 ? { lines } : {}),
      errorCode: fresh.errorCode ?? ending.errorCode,
      error: ending.error,
      ...(ending.outcome ? { outcome: ending.outcome } : {}),
      ...(duration !== null && ending.status === 'completed' ? { durationSeconds: duration } : {}),
    });
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
    if (task.providerCallId) this.scheduleCleanup(task.providerCallId);
    this.applyUpdate(taskId, {
      status: otherPartySpoke(task.lines) ? 'completed' : 'failed',
      errorCode: 'cancelled',
      error: 'Ended by the user',
    });
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
  }

  /**
   * After a restart: a simulated call has lost its script and will never
   * finish on its own, so close it rather than leave it "on the call" forever.
   */
  recoverAfterRestart(): void {
    for (const task of this.store.listActiveCalls()) {
      if (!task.simulated) continue;
      this.applyUpdate(task.id, {
        status: 'failed',
        errorCode: 'technical',
        error: 'The server restarted during the call',
      });
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
    for (const timer of this.cleanupTimers.values()) clearTimeout(timer);
    this.cleanupTimers.clear();
  }
}
