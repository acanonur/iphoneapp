/**
 * Money helpers. Everything is integer minor units ("cents") so that splitting
 * a bill never loses or invents a cent to floating-point rounding.
 */

/** Currencies whose minor unit is not 1/100. Enough to cover normal holidays. */
const EXPONENTS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  HUF: 0,
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

export function currencyExponent(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

/** "12,50" / "12.50" / "1 234,56" → 1250 / 1250 / 123456. */
export function parseAmountToCents(input: string, currency = 'EUR'): number | null {
  const exponent = currencyExponent(currency);
  let text = input.trim().replace(/[\s '’]/g, '');
  if (!text) return null;

  const negative = text.startsWith('-');
  if (negative) text = text.slice(1);

  // Strip anything that isn't a digit or a separator (currency symbols, codes).
  text = text.replace(/[^\d.,]/g, '');
  if (!text) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  let decimalSep = '';
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    // A single comma is a decimal separator unless it groups thousands ("1,234").
    decimalSep = text.length - lastComma - 1 === 3 && /^\d{1,3},\d{3}$/.test(text) ? '' : ',';
  } else if (lastDot >= 0) {
    decimalSep = text.length - lastDot - 1 === 3 && /^\d{1,3}\.\d{3}$/.test(text) ? '' : '.';
  }

  let whole = text;
  let fraction = '';
  if (decimalSep) {
    const idx = text.lastIndexOf(decimalSep);
    whole = text.slice(0, idx);
    fraction = text.slice(idx + 1);
  }
  whole = whole.replace(/[.,]/g, '');
  fraction = fraction.replace(/[.,]/g, '');

  if (!whole && !fraction) return null;

  const padded = (fraction + '0'.repeat(exponent)).slice(0, exponent);
  const cents = Number(whole || '0') * 10 ** exponent + Number(padded || '0');
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

export function formatCents(cents: number, currency = 'EUR', locale = 'de-DE'): string {
  const exponent = currencyExponent(currency);
  const value = cents / 10 ** exponent;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(value);
  } catch {
    return `${value.toFixed(exponent)} ${currency}`;
  }
}

/**
 * Split `total` into `weights.length` parts proportional to the weights, using
 * the largest-remainder method so the parts always sum back to exactly `total`.
 *
 * Ties in the remainder are broken by index, which keeps the result stable for
 * a given input order (callers sort by member id first).
 */
export function allocate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // Degenerate input (all-zero weights): fall back to an even split.
    return allocate(total, new Array(n).fill(1));
  }

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);

  const exact = weights.map((w) => (abs * w) / sum);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = abs - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const out = floors.slice();
  for (let k = 0; k < order.length && remainder > 0; k++) {
    out[order[k]!.i]! += 1;
    remainder -= 1;
  }
  return out.map((v) => v * sign);
}

/** Convert an amount in one currency into the trip currency. */
export function convert(amountCents: number, rateToTrip: number, from: string, to: string): number {
  if (from.toUpperCase() === to.toUpperCase()) return amountCents;
  const fromExp = currencyExponent(from);
  const toExp = currencyExponent(to);
  const scaled = (amountCents / 10 ** fromExp) * rateToTrip * 10 ** toExp;
  return Math.round(scaled);
}
