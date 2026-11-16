import './env.js';
import qrcode from 'qrcode-terminal';
import { API_VERSION, buildApp } from './app.js';
import { loadConfig, type Config } from './config.js';
import { advertise, lanUrls } from './discovery.js';
import { pairingLink } from './pairing.js';
import { describeError } from './providers/retell.js';
import { openTunnel } from './tunnel.js';

/** The server's window is read by a person: say what happens, with the time. */
function announce(line: string): void {
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  console.log(`  ${clock}  ${line}`);
}

/** Says in plain words why the server cannot start, and stops. */
function stopWith(lines: string[]): never {
  console.error('');
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
}

function qr(text: string): Promise<string> {
  return new Promise((resolve) => qrcode.generate(text, { small: true }, resolve));
}

/** Is a Yaver server already answering on this port — in another window, say? */
async function alreadyRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(700),
    });
    const body = (await response.json()) as { service?: unknown };
    return body.service === 'yaver';
  } catch {
    return false;
  }
}

async function main(config: Config): Promise<void> {
  // Before anything touches the data: a second server on the same folder
  // would take the first one's calls for leftovers of a crash and end them.
  if (await alreadyRunning(config.port)) {
    stopWith([
      `Yaver is already running on this computer (port ${config.port}) — probably in another Terminal window.`,
      'Use that window, or stop it there first (Ctrl-C) and then start again.',
    ]);
  }

  const app = buildApp(config, { announce });
  const { fastify } = app;

  // Things to shut down with the server. Collected here because Fastify takes
  // no new hooks once it is listening.
  const cleanups: Array<() => void> = [];
  fastify.addHook('onClose', async () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void fastify.close().finally(() => process.exit(0));
    });
  }

  try {
    await fastify.listen({ port: config.port, host: config.host });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      stopWith([
        `Port ${config.port} is already used by another program on this computer.`,
        'Start Yaver on another port, for example:   PORT=8788 npm start',
      ]);
    }
    throw error;
  }

  let publicUrl = config.publicBaseUrl;
  let tunnelNote: string | null = null;
  if (config.tunnel && !publicUrl) {
    try {
      const tunnel = await openTunnel(config.port, {
        onStopped: () => {
          app.setPublicBaseUrl(null);
          announce(
            'The public address has stopped working. Stop the server (Ctrl-C) and start it again to get a new one.',
          );
          // Calls are still answered; their notes are fetched instead of sent here.
          app.refreshCallAnswering().catch(() => {});
        },
      });
      publicUrl = tunnel.url;
      app.setPublicBaseUrl(publicUrl);
      cleanups.push(() => tunnel.stop());
    } catch (error) {
      tunnelNote = error instanceof Error ? error.message : String(error);
    }
  }

  if (config.advertise) {
    const announcement = advertise(
      config.port,
      { auth: app.accessKey ? 'key' : 'none', version: API_VERSION },
      announce,
    );
    cleanups.push(() => announcement.stop());
  }

  try {
    await app.refreshCallAnswering();
  } catch (error) {
    announce(
      `Call answering could not be checked at the phone service (${describeError(error)}). ` +
        'Calls are still answered as before; start the server again later to bring it up to date.',
    );
  }

  const local = lanUrls(config.port);
  const best = publicUrl ?? local[0] ?? `http://localhost:${config.port}`;
  const code = await qr(pairingLink(best, app.accessKey));

  // Plain text, not a log line: this is the part a person reads.
  const lines = [
    '',
    '────────────────────────────────────────────────────────',
    '  Yaver server is running',
    '',
    config.provider === 'retell'
      ? '  Calls:  REAL phone calls (Retell)'
      : '  Calls:  simulated — no real phone call is made',
    config.anthropicApiKey
      ? `  Reports: written by Claude (${config.anthropicModel})`
      : '  Reports: basic (no Anthropic key set)',
    '',
    ...(publicUrl ? [`  From anywhere:   ${publicUrl}`] : []),
    ...local.map((url, index) => `  ${index === 0 ? 'On this Wi-Fi:  ' : '                '} ${url}`),
    ...(tunnelNote ? ['', `  No public address: ${tunnelNote}`] : []),
    ...(app.accessKey ? ['', `  Access key:      ${app.accessKey}`] : []),
    '',
    '  Connect the iPhone: open the Camera, point it at this code,',
    '  tap the link, then tap "Open Yaver".',
    '',
    code,
    '  Or in the app: Settings → Server → Find automatically.',
    '',
    '  If the Mac asks whether "node" may accept incoming connections,',
    '  click Allow. Keep this window open; press Ctrl-C to stop the server.',
    '────────────────────────────────────────────────────────',
    '',
  ];
  console.log(lines.join('\n'));
}

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  // A setting the server cannot work with: say which, without a stack trace.
  stopWith([error instanceof Error ? error.message : String(error)]);
}

main(config).catch((error) => {
  console.error(error);
  process.exit(1);
});
