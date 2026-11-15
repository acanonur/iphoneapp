import './env.js';
import qrcode from 'qrcode-terminal';
import { API_VERSION, buildApp } from './app.js';
import { loadConfig } from './config.js';
import { advertise, lanUrls } from './discovery.js';
import { pairingLink } from './pairing.js';
import { describeError } from './providers/retell.js';
import { openTunnel } from './tunnel.js';

const config = loadConfig();

/** The server's window is read by a person: say what happens, with the time. */
function announce(line: string): void {
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  console.log(`  ${clock}  ${line}`);
}

const app = buildApp(config, { announce });
const { fastify } = app;

// Things to shut down with the server. Collected here because Fastify takes
// no new hooks once it is listening.
const cleanups: Array<() => void> = [];
fastify.addHook('onClose', async () => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function qr(text: string): Promise<string> {
  return new Promise((resolve) => qrcode.generate(text, { small: true }, resolve));
}

async function main(): Promise<void> {
  await fastify.listen({ port: config.port, host: config.host });

  let publicUrl = config.publicBaseUrl;
  let tunnelNote: string | null = null;
  if (config.tunnel && !publicUrl) {
    try {
      const tunnel = await openTunnel(config.port);
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
    fastify.log.warn(`Could not point incoming calls at this server: ${describeError(error)}`);
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

main().catch((error) => {
  fastify.log.error(error);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void fastify.close().finally(() => process.exit(0));
  });
}
