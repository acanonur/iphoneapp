/**
 * Invites: how a second person joins a project.
 *
 * The app has to know which server holds the project's data, but that is the
 * app's problem, not the household's. Asking for it on the first screen made
 * "where does this live?" the very first question anyone was asked, and put the
 * burden on the person least able to answer it — the one being invited, who has
 * only been handed a code.
 *
 * So an invite carries the address with it. The person who starts the project
 * configures the server once; everyone after them pastes one string and is
 * never asked. The string is a link, so tapping it in WhatsApp opens the app
 * with both fields already filled, and it is also readable enough to be typed
 * out or read down the phone if the link does not survive the trip.
 */

/** Characters used by invite codes: no 0/O or 1/I/l to confuse. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export interface JoinDetails {
  inviteCode: string | null;
  serverUrl: string | null;
}

/**
 * Tidy a typed invite code into the form the server stores.
 *
 * People retype these from a screenshot or a phone call, so lowercase, missing
 * or extra dashes, and stray spaces all have to arrive at the same answer.
 * Returns null when nothing usable is left.
 */
export function normaliseInviteCode(raw: string): string | null {
  const letters = raw
    .toUpperCase()
    .split('')
    .filter((ch) => CODE_ALPHABET.includes(ch))
    .join('');

  if (letters.length !== CODE_LENGTH) return null;
  return `${letters.slice(0, 4)}-${letters.slice(4)}`;
}

/**
 * Tidy a server address into the form the client stores.
 *
 * A missing scheme becomes http, which is the home-network case — nobody puts
 * a certificate on a Raspberry Pi. A path is *kept*: a server behind a reverse
 * proxy may well live at example.com/ortak, and throwing the prefix away would
 * quietly point every request at the wrong place. Only trailing slashes go.
 */
export function normaliseServerUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return null;
  }
}

/**
 * The link that carries an invite.
 *
 * `ortak://join?...` rather than an https link: there is no website to host a
 * redirect, and a custom scheme opens the app directly on both platforms.
 */
export function buildJoinLink(input: { serverUrl: string; inviteCode: string }): string {
  const server = normaliseServerUrl(input.serverUrl) ?? input.serverUrl.trim();
  const code = normaliseInviteCode(input.inviteCode) ?? input.inviteCode.trim();
  return `ortak://join?code=${encodeURIComponent(code)}&server=${encodeURIComponent(server)}`;
}

/**
 * The whole message to send someone, link included.
 *
 * Written to survive being pasted into WhatsApp, where a bare link with no
 * explanation looks like something you should not tap.
 */
export function buildInviteMessage(input: {
  serverUrl: string;
  inviteCode: string;
  spaceName?: string | null;
  invitedBy?: string | null;
}): string {
  const project = input.spaceName?.trim();
  const from = input.invitedBy?.trim();
  const code = normaliseInviteCode(input.inviteCode) ?? input.inviteCode.trim();

  const opening = project
    ? `Join ${project} on Ortak${from ? ` — ${from} invited you` : ''}.`
    : `Join me on Ortak${from ? ` — ${from}` : ''}.`;

  return [
    opening,
    '',
    'Open Ortak and tap Join, then paste this:',
    buildJoinLink({ serverUrl: input.serverUrl, inviteCode: input.inviteCode }),
    '',
    `Or type the code by hand: ${code}`,
  ].join('\n');
}

/**
 * Read an invite out of whatever someone pasted.
 *
 * Accepts a join link, a whole forwarded message with a link somewhere in it,
 * or a bare code. Either field may come back null: a bare code carries no
 * server, and a link missing its code is still worth the address it has.
 */
export function parseJoinInput(raw: string): JoinDetails {
  const text = raw.trim();
  if (!text) return { inviteCode: null, serverUrl: null };

  const link = /ortak:\/\/join\?[^\s<>"']+/i.exec(text);
  if (link) {
    const query = link[0].slice(link[0].indexOf('?') + 1);
    const params = new URLSearchParams(query);
    return {
      inviteCode: normaliseInviteCode(params.get('code') ?? ''),
      serverUrl: normaliseServerUrl(params.get('server') ?? ''),
    };
  }

  // No link: treat the text as a code, but only if it is plausibly one. A
  // pasted paragraph should not be mistaken for an invite because it happens to
  // contain eight usable letters.
  const looksLikeACode = /^[A-Za-z0-9\s-]{8,20}$/.test(text);
  return {
    inviteCode: looksLikeACode ? normaliseInviteCode(text) : null,
    serverUrl: null,
  };
}
