/**
 * Trip expense splitting: turn a pile of "who paid what for whom" into
 * "who owes whom how much", with as few transfers as possible.
 *
 * All amounts are integer minor units of the trip currency. Every function is
 * pure so the phone can recompute balances offline and the server can agree.
 */

import { allocate, convert } from './money.js';
import type { Expense, ExpenseSplit, Settlement, TripMember } from './types.js';

export interface MemberBalance {
  memberId: string;
  /** Total this member paid out of pocket, in trip currency. */
  paidCents: number;
  /** Total this member consumed (their slices of all expenses). */
  owedCents: number;
  /** Net repayments already made: positive = they have sent money out. */
  settledOutCents: number;
  settledInCents: number;
  /** paid − owed + settledOut − settledIn. Positive → they are owed money. */
  netCents: number;
}

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

export interface TripSummary {
  currency: string;
  /** Sum of every expense, in trip currency. */
  totalCents: number;
  balances: MemberBalance[];
  /** Minimal set of payments that brings every balance to zero. */
  transfers: Transfer[];
  /** Expenses that could not be split (unknown payer, empty split, …). */
  problems: SplitProblem[];
}

export interface SplitProblem {
  expenseId: string;
  reason: string;
}

/**
 * Work out each participant's slice of one expense.
 *
 * Returns integer cents that sum to exactly the expense amount (in the expense's
 * own currency). Members are sorted by id first so rounding remainders land on
 * the same people no matter what order the splits arrived in.
 */
export function computeSplitShares(
  amountCents: number,
  mode: Expense['splitMode'],
  splits: ExpenseSplit[],
): Map<string, number> {
  const result = new Map<string, number>();
  const ordered = [...splits].sort((a, b) => (a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0));
  if (ordered.length === 0) return result;

  if (mode === 'exact') {
    // Trust the entered numbers, but absorb any drift from the total on the
    // last member so the expense still balances.
    let running = 0;
    ordered.forEach((s, i) => {
      const value = Math.round(s.amountCents ?? 0);
      if (i === ordered.length - 1) {
        result.set(s.memberId, amountCents - running);
      } else {
        result.set(s.memberId, value);
        running += value;
      }
    });
    return result;
  }

  const weights = ordered.map((s) => {
    if (mode === 'equal') return 1;
    const w = s.weight ?? 0;
    return Number.isFinite(w) && w > 0 ? w : 0;
  });

  const parts = allocate(amountCents, weights);
  ordered.forEach((s, i) => result.set(s.memberId, parts[i] ?? 0));
  return result;
}

/**
 * Compute per-member balances for a trip.
 *
 * Expenses in a foreign currency are converted with their stored rate, so a
 * Turkish-lira dinner on a euro trip still nets out correctly.
 */
export function computeBalances(
  members: TripMember[],
  expenses: Expense[],
  settlements: Settlement[],
  tripCurrency: string,
): { balances: MemberBalance[]; totalCents: number; problems: SplitProblem[] } {
  const known = new Set(members.map((m) => m.id));
  const problems: SplitProblem[] = [];

  const acc = new Map<string, MemberBalance>();
  for (const m of members) {
    acc.set(m.id, {
      memberId: m.id,
      paidCents: 0,
      owedCents: 0,
      settledOutCents: 0,
      settledInCents: 0,
      netCents: 0,
    });
  }

  let totalCents = 0;

  for (const expense of expenses) {
    if (expense.deleted) continue;

    if (!known.has(expense.paidBy)) {
      problems.push({ expenseId: expense.id, reason: `payer ${expense.paidBy} is not a trip member` });
      continue;
    }
    const participants = expense.splits.filter((s) => known.has(s.memberId));
    if (participants.length === 0) {
      problems.push({ expenseId: expense.id, reason: 'no valid participants in the split' });
      continue;
    }
    if (participants.length !== expense.splits.length) {
      problems.push({ expenseId: expense.id, reason: 'some participants are no longer trip members' });
    }

    const inTrip = convert(expense.amountCents, expense.rateToTrip, expense.currency, tripCurrency);
    totalCents += inTrip;
    acc.get(expense.paidBy)!.paidCents += inTrip;

    const shares = computeSplitShares(inTrip, expense.splitMode, participants);
    for (const [memberId, cents] of shares) {
      acc.get(memberId)!.owedCents += cents;
    }
  }

  for (const s of settlements) {
    if (s.deleted) continue;
    if (!known.has(s.fromMemberId) || !known.has(s.toMemberId)) continue;
    acc.get(s.fromMemberId)!.settledOutCents += s.amountCents;
    acc.get(s.toMemberId)!.settledInCents += s.amountCents;
  }

  const balances = members.map((m) => {
    const b = acc.get(m.id)!;
    b.netCents = b.paidCents - b.owedCents + b.settledOutCents - b.settledInCents;
    return b;
  });

  return { balances, totalCents, problems };
}

/**
 * Reduce a set of balances to the fewest transfers that settle everyone.
 *
 * Greedy largest-debtor / largest-creditor matching. Each step zeroes at least
 * one participant, so the result never needs more than n−1 payments — the point
 * being that four friends settle a holiday with two bank transfers, not twelve.
 */
export function simplifyDebts(balances: MemberBalance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.memberId, amount: -b.netCents }))
    .sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : 1));
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.memberId, amount: b.netCents }))
    .sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : 1));

  const transfers: Transfer[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]!;
    const creditor = creditors[ci]!;
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      transfers.push({ fromMemberId: debtor.id, toMemberId: creditor.id, amountCents: amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
    }

    if (debtor.amount === 0) di++;
    if (creditor.amount === 0) ci++;
  }

  return transfers;
}

export function summarizeTrip(
  members: TripMember[],
  expenses: Expense[],
  settlements: Settlement[],
  tripCurrency: string,
): TripSummary {
  const live = members.filter((m) => !m.deleted);
  const { balances, totalCents, problems } = computeBalances(live, expenses, settlements, tripCurrency);
  return {
    currency: tripCurrency,
    totalCents,
    balances,
    transfers: simplifyDebts(balances),
    problems,
  };
}

/** The two lines one person actually cares about: what I owe, what I'm owed. */
export function personalView(summary: TripSummary, memberId: string): {
  netCents: number;
  owes: Transfer[];
  isOwed: Transfer[];
} {
  const balance = summary.balances.find((b) => b.memberId === memberId);
  return {
    netCents: balance?.netCents ?? 0,
    owes: summary.transfers.filter((t) => t.fromMemberId === memberId),
    isOwed: summary.transfers.filter((t) => t.toMemberId === memberId),
  };
}

/** Convenience for the "everyone splits it evenly" case, which is most of them. */
export function equalSplitAmong(memberIds: string[]): ExpenseSplit[] {
  return memberIds.map((memberId) => ({ memberId }));
}
