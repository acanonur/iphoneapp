import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openTunnel } from '../src/tunnel.js';

const savedPath = process.env.PATH;
let directory: string | null = null;

/** Puts a stand-in for `cloudflared` first on the PATH. */
function fakeCloudflared(script: string): void {
  directory = mkdtempSync(join(tmpdir(), 'yaver-tunnel-'));
  const file = join(directory, 'cloudflared');
  writeFileSync(file, `#!/bin/sh\n${script}\n`);
  chmodSync(file, 0o755);
  process.env.PATH = `${directory}${delimiter}${savedPath}`;
}

afterEach(() => {
  process.env.PATH = savedPath;
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = null;
});

describe('the public tunnel', () => {
  it('takes its address from the line cloudflared announces it on', async () => {
    fakeCloudflared(
      'echo "INF |  https://quiet-river-1234.trycloudflare.com  |" >&2\nexec sleep 30',
    );
    const tunnel = await openTunnel(8787, { timeoutMs: 5_000 });
    expect(tunnel.url).toBe('https://quiet-river-1234.trycloudflare.com');
    tunnel.stop();
  });

  it('does not mistake the address in an error message for a tunnel', async () => {
    // What cloudflared prints when it cannot get a tunnel at all.
    fakeCloudflared(
      'echo "ERR failed to request quick Tunnel: Post \\"https://api.trycloudflare.com/tunnel\\": dial tcp: lookup api.trycloudflare.com: no such host" >&2\nexit 1',
    );
    await expect(openTunnel(8787, { timeoutMs: 5_000 })).rejects.toThrow(/stopped/);
  });

  it('says so when a tunnel that was up goes away', async () => {
    fakeCloudflared('echo "https://quiet-river-1234.trycloudflare.com"\nsleep 0.2\nexit 1');
    let stopped = false;
    const tunnel = await openTunnel(8787, { timeoutMs: 5_000, onStopped: () => (stopped = true) });
    expect(tunnel.url).toContain('quiet-river-1234');
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(stopped).toBe(true);
  });
});
