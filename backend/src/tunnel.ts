import { spawn, type ChildProcess } from 'node:child_process';

export interface Tunnel {
  url: string;
  stop(): void;
}

const TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

/**
 * Gives this server an address on the public internet through a Cloudflare
 * quick tunnel — no account, no router settings. The phone can then reach the
 * server from anywhere, and the phone company can deliver call events to it.
 *
 * The address is new every time the tunnel starts. That is fine for calls the
 * secretary places (each call is told the current address); a setup that
 * answers calls permanently should run on a server with a fixed address.
 */
export function openTunnel(port: number, timeoutMs = 30_000): Promise<Tunnel> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(
        'cloudflared',
        ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(new Error(message));
    };
    const timer = setTimeout(
      () => fail('The tunnel did not come up in time. Check the internet connection.'),
      timeoutMs,
    );

    const scan = (chunk: Buffer) => {
      const match = TUNNEL_URL.exec(chunk.toString('utf8'));
      if (!match || settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ url: match[0], stop: () => child.kill() });
    };
    child.stdout?.on('data', scan);
    child.stderr?.on('data', scan);
    child.on('error', (error: NodeJS.ErrnoException) => {
      fail(
        error.code === 'ENOENT'
          ? 'cloudflared is not installed. On a Mac: brew install cloudflared'
          : `The tunnel could not start: ${error.message}`,
      );
    });
    child.on('exit', (code) => fail(`The tunnel stopped (exit code ${code ?? 'unknown'})`));
  });
}
