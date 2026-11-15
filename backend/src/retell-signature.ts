import { createHmac, timingSafeEqual } from 'node:crypto';

/** Retell signs with a millisecond timestamp and allows five minutes of skew. */
const RETELL_SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
const RETELL_SIGNATURE_PATTERN = /^v=(\d+),d=([0-9a-f]{64})$/i;

export interface VerifyRetellSignatureOptions {
  /** Clock to compare against, in ms since the epoch. Defaults to Date.now(). */
  now?: number;
  /** Accepted distance between `now` and the signed timestamp. Defaults to 5 min. */
  toleranceMs?: number;
}

/**
 * Verifies the `x-retell-signature` header of a Retell webhook:
 * "v=<unix ms>,d=<hex HMAC-SHA256(apiKey, rawBody + timestamp)>".
 *
 * `rawBody` must be the request body exactly as it arrived (string or
 * Buffer) - never JSON that was parsed and serialised again.
 */
export function verifyRetellSignature(
  rawBody: string | Buffer,
  apiKey: string,
  signature: unknown,
  options: VerifyRetellSignatureOptions = {},
): boolean {
  if (typeof apiKey !== 'string' || apiKey.length === 0) return false;
  if (typeof signature !== 'string') return false;
  if (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) return false;

  const match = RETELL_SIGNATURE_PATTERN.exec(signature);
  const stamp = match?.[1];
  const digest = match?.[2];
  if (!stamp || !digest) return false;

  const signedAt = Number(stamp);
  const now = options.now ?? Date.now();
  const toleranceMs = options.toleranceMs ?? RETELL_SIGNATURE_TOLERANCE_MS;
  if (
    !Number.isSafeInteger(signedAt) ||
    !Number.isFinite(now) ||
    !Number.isFinite(toleranceMs) ||
    toleranceMs < 0 ||
    Math.abs(now - signedAt) > toleranceMs
  ) {
    return false;
  }

  const expected = createHmac('sha256', apiKey)
    .update(rawBody)
    .update(String(signedAt))
    .digest();
  const provided = Buffer.from(digest, 'hex');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/** Signs a body the way Retell does - for tests and local webhook replays. */
export function signRetellPayload(
  rawBody: string | Buffer,
  apiKey: string,
  timestamp: number = Date.now(),
): string {
  const digest = createHmac('sha256', apiKey)
    .update(rawBody)
    .update(String(timestamp))
    .digest('hex');
  return `v=${timestamp},d=${digest}`;
}
