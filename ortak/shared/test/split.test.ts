import { describe, expect, it } from 'vitest';
import { allocate, parseAmountToCents, formatCents, convert } from '../src/money.js';
import {
  computeSplitShares,
  computeBalances,
  simplifyDebts,
  summarizeTrip,
  personalView,
  equalSplitAmong,
} from '../src/split.js';
import type { Expense, Settlement, TripMember } from '../src/types.js';

const sync = { spaceId: 's', rev: 1, updatedAt: 0, deleted: false, createdBy: 'u1' };

function member(id: string, name: string): TripMember {
  return { ...sync, id, tripId: 't1', name, userId: null, color: null };
}

function expense(over: Partial<Expense> & Pick<Expense, 'id' | 'amountCents' | 'paidBy' | 'splits'>): Expense {
  return {
    ...sync,
    tripId: 't1',
    description: 'x',
    currency: 'EUR',
    rateToTrip: 1,
    spentAt: 0,
    category: null,
    splitMode: 'equal',
    note: null,
    ...over,
  };
}

describe('allocate', () => {
  it('splits evenly when it divides cleanly', () => {
    expect(allocate(900, [1, 1, 1])).toEqual([300, 300, 300]);
  });

  it('never loses or invents a cent', () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts.sort((a, b) => b - a)).toEqual([34, 33, 33]);
  });

  it('respects weights', () => {
    expect(allocate(1000, [3, 1, 1])).toEqual([600, 200, 200]);
  });

  it('handles awkward remainders across many people', () => {
    for (const total of [1, 7, 99, 101, 12345, 99999]) {
      for (const n of [2, 3, 5, 7, 11]) {
        const parts = allocate(total, new Array(n).fill(1));
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('falls back to an even split when all weights are zero', () => {
    expect(allocate(300, [0, 0, 0])).toEqual([100, 100, 100]);
  });

  it('handles negative totals (refunds)', () => {
    const parts = allocate(-100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-100);
  });
});

describe('parseAmountToCents', () => {
  it('reads both decimal conventions', () => {
    expect(parseAmountToCents('12,50')).toBe(1250);
    expect(parseAmountToCents('12.50')).toBe(1250);
    expect(parseAmountToCents('12')).toBe(1200);
  });

  it('reads grouped thousands', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123456);
    expect(parseAmountToCents('1,234.56')).toBe(123456);
    expect(parseAmountToCents('1 234,56')).toBe(123456);
  });

  it('ignores currency symbols', () => {
    expect(parseAmountToCents('€ 42,00')).toBe(4200);
    expect(parseAmountToCents('42.00 EUR')).toBe(4200);
    expect(parseAmountToCents('₺1.250,75')).toBe(125075);
  });

  it('pads and truncates fractional digits', () => {
    expect(parseAmountToCents('12,5')).toBe(1250);
    expect(parseAmountToCents('12.5678')).toBe(1256);
  });

  it('reads a separator with exactly three trailing digits as grouping', () => {
    // "12,567" is far more often twelve thousand than 12 euros 567, and reading
    // it as grouping keeps it consistent with "1.234,56".
    expect(parseAmountToCents('12,567')).toBe(1256700);
    expect(parseAmountToCents('12.567')).toBe(1256700);
  });

  it('respects zero-decimal currencies', () => {
    expect(parseAmountToCents('1500', 'JPY')).toBe(1500);
    expect(parseAmountToCents('1.500', 'JPY')).toBe(1500);
  });

  it('rejects junk', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats without throwing on odd currencies', () => {
    expect(formatCents(1250, 'EUR', 'de-DE')).toContain('12,50');
    expect(formatCents(1500, 'JPY', 'en-US')).toContain('1,500');
  });
});

describe('convert', () => {
  it('is a no-op for the same currency', () => {
    expect(convert(1000, 1, 'EUR', 'EUR')).toBe(1000);
    expect(convert(1000, 33, 'EUR', 'EUR')).toBe(1000);
  });

  it('converts between two-decimal currencies', () => {
    // 100,00 TRY at 0.028 → 2,80 EUR
    expect(convert(10000, 0.028, 'TRY', 'EUR')).toBe(280);
  });

  it('handles a zero-decimal source currency', () => {
    // 1500 JPY at 0.0062 → 9,30 EUR
    expect(convert(1500, 0.0062, 'JPY', 'EUR')).toBe(930);
  });
});

describe('computeSplitShares', () => {
  it('splits equally and sums exactly', () => {
    const shares = computeSplitShares(1000, 'equal', equalSplitAmong(['a', 'b', 'c']));
    expect([...shares.values()].reduce((x, y) => x + y, 0)).toBe(1000);
  });

  it('splits by shares', () => {
    const shares = computeSplitShares(1000, 'shares', [
      { memberId: 'a', weight: 3 },
      { memberId: 'b', weight: 1 },
    ]);
    expect(shares.get('a')).toBe(750);
    expect(shares.get('b')).toBe(250);
  });

  it('splits by percent', () => {
    const shares = computeSplitShares(20000, 'percent', [
      { memberId: 'a', weight: 60 },
      { memberId: 'b', weight: 40 },
    ]);
    expect(shares.get('a')).toBe(12000);
    expect(shares.get('b')).toBe(8000);
  });

  it('uses exact amounts and absorbs drift on the last member', () => {
    const shares = computeSplitShares(1000, 'exact', [
      { memberId: 'a', amountCents: 700 },
      { memberId: 'b', amountCents: 250 },
    ]);
    expect(shares.get('a')).toBe(700);
    expect(shares.get('b')).toBe(300); // 50 cents of drift absorbed, total stays 1000
  });

  it('is order-independent', () => {
    const forward = computeSplitShares(100, 'equal', equalSplitAmong(['a', 'b', 'c']));
    const reverse = computeSplitShares(100, 'equal', equalSplitAmong(['c', 'b', 'a']));
    expect([...forward.entries()].sort()).toEqual([...reverse.entries()].sort());
  });
});

describe('computeBalances', () => {
  const members = [member('a', 'Onur'), member('b', 'Tugce'), member('c', 'Ali')];

  it('handles the classic "one person pays for everyone"', () => {
    const expenses = [
      expense({ id: 'e1', amountCents: 9000, paidBy: 'a', splits: equalSplitAmong(['a', 'b', 'c']) }),
    ];
    const { balances, totalCents } = computeBalances(members, expenses, [], 'EUR');
    expect(totalCents).toBe(9000);
    expect(balances.find((b) => b.memberId === 'a')!.netCents).toBe(6000);
    expect(balances.find((b) => b.memberId === 'b')!.netCents).toBe(-3000);
    expect(balances.find((b) => b.memberId === 'c')!.netCents).toBe(-3000);
  });

  it('always nets to zero across everyone', () => {
    const expenses = [
      expense({ id: 'e1', amountCents: 9137, paidBy: 'a', splits: equalSplitAmong(['a', 'b', 'c']) }),
      expense({ id: 'e2', amountCents: 4201, paidBy: 'b', splits: equalSplitAmong(['b', 'c']) }),
      expense({ id: 'e3', amountCents: 777, paidBy: 'c', splits: equalSplitAmong(['a', 'c']) }),
    ];
    const { balances } = computeBalances(members, expenses, [], 'EUR');
    expect(balances.reduce((sum, b) => sum + b.netCents, 0)).toBe(0);
  });

  it('applies settlements', () => {
    const expenses = [
      expense({ id: 'e1', amountCents: 6000, paidBy: 'a', splits: equalSplitAmong(['a', 'b']) }),
    ];
    const settlements: Settlement[] = [
      { ...sync, id: 's1', tripId: 't1', fromMemberId: 'b', toMemberId: 'a', amountCents: 3000, settledAt: 0, note: null },
    ];
    const { balances } = computeBalances(members, expenses, settlements, 'EUR');
    expect(balances.find((b) => b.memberId === 'a')!.netCents).toBe(0);
    expect(balances.find((b) => b.memberId === 'b')!.netCents).toBe(0);
  });

  it('converts foreign-currency expenses into the trip currency', () => {
    const expenses = [
      expense({
        id: 'e1',
        amountCents: 100000, // 1000,00 TRY
        currency: 'TRY',
        rateToTrip: 0.028,
        paidBy: 'a',
        splits: equalSplitAmong(['a', 'b']),
      }),
    ];
    const { totalCents, balances } = computeBalances(members, expenses, [], 'EUR');
    expect(totalCents).toBe(2800);
    expect(balances.find((b) => b.memberId === 'b')!.netCents).toBe(-1400);
  });

  it('skips deleted expenses', () => {
    const expenses = [
      expense({ id: 'e1', amountCents: 1000, paidBy: 'a', splits: equalSplitAmong(['a', 'b']), deleted: true }),
    ];
    expect(computeBalances(members, expenses, [], 'EUR').totalCents).toBe(0);
  });

  it('reports an unknown payer instead of silently dropping money', () => {
    const expenses = [expense({ id: 'e1', amountCents: 1000, paidBy: 'ghost', splits: equalSplitAmong(['a']) })];
    const { problems, totalCents } = computeBalances(members, expenses, [], 'EUR');
    expect(totalCents).toBe(0);
    expect(problems[0]!.expenseId).toBe('e1');
  });
});

describe('simplifyDebts', () => {
  it('settles a three-way holiday in two transfers', () => {
    const members = [member('a', 'Onur'), member('b', 'Tugce'), member('c', 'Ali')];
    const expenses = [
      expense({ id: 'e1', amountCents: 9000, paidBy: 'a', splits: equalSplitAmong(['a', 'b', 'c']) }),
    ];
    const summary = summarizeTrip(members, expenses, [], 'EUR');
    expect(summary.transfers).toHaveLength(2);
    expect(summary.transfers.every((t) => t.toMemberId === 'a')).toBe(true);
    expect(summary.transfers.reduce((s, t) => s + t.amountCents, 0)).toBe(6000);
  });

  it('cancels out circular debt instead of moving money in a loop', () => {
    // a paid for b, b paid for c, c paid for a — all equal, so nobody owes anything.
    const members = [member('a', 'A'), member('b', 'B'), member('c', 'C')];
    const expenses = [
      expense({ id: 'e1', amountCents: 3000, paidBy: 'a', splits: equalSplitAmong(['a', 'b', 'c']) }),
      expense({ id: 'e2', amountCents: 3000, paidBy: 'b', splits: equalSplitAmong(['a', 'b', 'c']) }),
      expense({ id: 'e3', amountCents: 3000, paidBy: 'c', splits: equalSplitAmong(['a', 'b', 'c']) }),
    ];
    expect(summarizeTrip(members, expenses, [], 'EUR').transfers).toHaveLength(0);
  });

  it('needs at most n-1 transfers and clears every balance', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const members = ids.map((id) => member(id, id.toUpperCase()));
    const expenses = [
      expense({ id: 'e1', amountCents: 12345, paidBy: 'a', splits: equalSplitAmong(ids) }),
      expense({ id: 'e2', amountCents: 8000, paidBy: 'b', splits: equalSplitAmong(['b', 'c', 'd']) }),
      expense({ id: 'e3', amountCents: 5555, paidBy: 'f', splits: equalSplitAmong(ids) }),
      expense({ id: 'e4', amountCents: 999, paidBy: 'c', splits: equalSplitAmong(['a', 'f']) }),
    ];
    const summary = summarizeTrip(members, expenses, [], 'EUR');
    expect(summary.transfers.length).toBeLessThanOrEqual(ids.length - 1);

    // Applying the transfers must zero out every single balance.
    const net = new Map(summary.balances.map((b) => [b.memberId, b.netCents]));
    for (const t of summary.transfers) {
      net.set(t.fromMemberId, net.get(t.fromMemberId)! + t.amountCents);
      net.set(t.toMemberId, net.get(t.toMemberId)! - t.amountCents);
    }
    for (const value of net.values()) expect(value).toBe(0);
  });

  it('produces no transfers when everyone is square', () => {
    expect(simplifyDebts([])).toEqual([]);
    expect(
      simplifyDebts([
        { memberId: 'a', paidCents: 0, owedCents: 0, settledOutCents: 0, settledInCents: 0, netCents: 0 },
      ]),
    ).toEqual([]);
  });
});

describe('personalView', () => {
  it('shows what one person owes and is owed', () => {
    const members = [member('a', 'Onur'), member('b', 'Tugce')];
    const expenses = [
      expense({ id: 'e1', amountCents: 5000, paidBy: 'a', splits: equalSplitAmong(['a', 'b']) }),
    ];
    const summary = summarizeTrip(members, expenses, [], 'EUR');
    const tugce = personalView(summary, 'b');
    expect(tugce.netCents).toBe(-2500);
    expect(tugce.owes).toEqual([{ fromMemberId: 'b', toMemberId: 'a', amountCents: 2500 }]);
    expect(tugce.isOwed).toEqual([]);
  });
});
