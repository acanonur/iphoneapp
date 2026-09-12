/**
 * Client-generated record ids.
 *
 * Ids are made on the device so a record created with no signal is complete
 * immediately and keeps the same identity once it reaches the server. The
 * timestamp prefix keeps ids roughly sortable by creation time, which makes
 * debugging a sync problem much easier.
 *
 * Format matches the server's validation: [A-Za-z0-9_-], up to 64 characters.
 */

let counter = Math.floor(Math.random() * 4096);

export function newId(prefix = ''): string {
  counter = (counter + 1) % 4096;
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(3, '0');
  const random = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(5, '0');
  const id = `${time}-${seq}${random}`;
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * A sort key that sits between two neighbours, so reordering a list writes one
 * row instead of renumbering the whole thing.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return 0;
  if (before == null) return after! - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}
