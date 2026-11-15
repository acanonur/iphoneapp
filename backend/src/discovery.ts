import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { hostname, networkInterfaces, platform } from 'node:os';

/** The Bonjour service type the app browses for. */
export const SERVICE_TYPE = '_yaver._tcp';

/** This computer's addresses on the local network, most likely home/office ones first. */
export function lanAddresses(): string[] {
  const found: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      // Link-local addresses mean "no network"; nothing can reach them usefully.
      if (entry.address.startsWith('169.254.')) continue;
      found.push(entry.address);
    }
  }
  const rank = (address: string) =>
    address.startsWith('192.168.') ? 0 : address.startsWith('10.') ? 1 : 2;
  return [...new Set(found)].sort((a, b) => rank(a) - rank(b));
}

/**
 * The name this computer answers to on the local network ("Cans-MacBook.local").
 * Unlike its address, the name stays the same when the router hands out a new
 * address, so the app prefers it once it has it.
 */
export function localHostName(): string | null {
  if (platform() === 'darwin') {
    try {
      const name = execFileSync('scutil', ['--get', 'LocalHostName'], {
        encoding: 'utf8',
        timeout: 2_000,
      }).trim();
      if (name) return `${name}.local`;
    } catch {
      // Fall through to the generic host name.
    }
  }
  const generic = hostname();
  return generic.endsWith('.local') ? generic : null;
}

/** Every address on the local network the app could use to reach this server. */
export function lanUrls(port: number): string[] {
  const local = localHostName();
  return [
    ...lanAddresses().map((address) => `http://${address}:${port}`),
    ...(local ? [`http://${local}:${port}`] : []),
  ];
}

export interface Advertisement {
  stop(): void;
}

/**
 * Announces the server on the local network (Bonjour), so the app finds it
 * without anybody typing an address — and finds it again when the address
 * changes. Uses the tool the operating system ships with; if there is none,
 * the server simply is not announced.
 */
export function advertise(
  port: number,
  details: { auth: 'key' | 'none'; version: number },
  log: (message: string) => void,
): Advertisement {
  let child: ChildProcess | null = null;
  let published = '';
  let stopped = false;

  const start = () => {
    const addresses = lanAddresses();
    const local = localHostName();
    published = addresses.join(',');
    const name = `Yaver on ${hostname().replace(/\.local$/, '')}`;
    const txt = [
      `v=${details.version}`,
      `auth=${details.auth}`,
      `port=${port}`,
      `addrs=${published}`,
      ...(local ? [`host=${local}`] : []),
    ];

    const command =
      platform() === 'darwin'
        ? { file: 'dns-sd', args: ['-R', name, SERVICE_TYPE, 'local', String(port), ...txt] }
        : { file: 'avahi-publish-service', args: [name, SERVICE_TYPE, String(port), ...txt] };

    const spawned = spawn(command.file, command.args, { stdio: 'ignore' });
    spawned.on('error', () => {
      // The tool is not installed: the app can still be given the address by hand.
      if (!stopped) log(`Not announced on the local network (${command.file} is not available)`);
      if (child === spawned) child = null;
    });
    child = spawned;
  };

  start();

  // A laptop changes address when it joins another network or wakes up; the
  // announcement carries the addresses, so it has to follow.
  const watcher = setInterval(() => {
    if (stopped || lanAddresses().join(',') === published) return;
    child?.kill();
    start();
  }, 20_000);
  watcher.unref();

  return {
    stop() {
      stopped = true;
      clearInterval(watcher);
      child?.kill();
      child = null;
    },
  };
}
