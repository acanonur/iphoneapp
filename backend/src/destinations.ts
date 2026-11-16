/**
 * Which numbers the server is willing to dial.
 *
 * The country allowlist alone is not enough to protect the owner's money:
 * inside every allowed country there are numbers that cost many times a
 * normal call (premium-rate, televoting, directory enquiries), and behind
 * "+1" sit some twenty-five countries and territories that share the prefix
 * with the US and Canada but are charged as international calls — the usual
 * destination of "call me back" scams. A secretary has no business calling
 * any of them, and nobody asks one to call the police.
 */

/** Refused although the country is allowed. Longest-known special ranges only. */
export const DEFAULT_BLOCKED_PREFIXES = [
  // Germany: premium rate, televoting, directory enquiries, online-service
  // numbers; police and emergency.
  '+49900',
  '+49137',
  '+49118',
  '+4919',
  '+49110',
  '+49112',
  // Türkiye: premium rate; nothing a person can be reached on starts with 1
  // (emergency and service short codes).
  '+90900',
  '+901',
  // United Kingdom: premium rate (and 999), personal numbering, the dearer
  // service numbers.
  '+449',
  '+4470',
  '+44871',
  '+44872',
  '+44873',
  // US and Canada: premium rate, and 911.
  '+1900',
  '+1976',
  '+1911',
];

/**
 * Area codes that start with "+1" but are not the US mainland or Canada: the
 * Caribbean, Bermuda and the Pacific territories.
 */
const NANP_ELSEWHERE = new Set([
  '242', '246', '264', '268', '284', '340', '345', '441', '473', '649', '658', '664', '670',
  '671', '684', '721', '758', '767', '784', '787', '809', '829', '849', '868', '869', '876',
  '939',
]);

export type Refusal = 'country' | 'special';

/**
 * Whether a number (E.164, "+4930…") may be dialled.
 * `country`: its country is not on the owner's list. `special`: it is a
 * premium-rate, service or emergency number, or one of the costly "+1" places.
 *
 * One rule opens a refused range again: an entry on the owner's own list that
 * names it — "+1876" for Jamaica, "+49900" for German premium rate. Nothing
 * is opened by accident: "+49" does not open "+49900".
 */
export function refusalFor(
  number: string,
  allowedPrefixes: string[],
  blockedPrefixes: string[],
): Refusal | null {
  if (!allowedPrefixes.some((prefix) => number.startsWith(prefix))) return 'country';
  const blocked =
    blockedPrefixes.find((prefix) => number.startsWith(prefix)) ??
    (number.startsWith('+1') && NANP_ELSEWHERE.has(number.slice(2, 5)) ? number.slice(0, 5) : null);
  if (blocked === null || blocked === undefined) return null;
  const deliberate = allowedPrefixes.some(
    (prefix) => prefix.length >= blocked.length && number.startsWith(prefix),
  );
  return deliberate ? null : 'special';
}
