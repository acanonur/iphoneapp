/**
 * Switches on reports written by Claude: asks for an Anthropic API key and
 * keeps it in backend/.env.
 *
 *   npm run claude:setup
 *
 * With a key, the report on each call — what happened, what was agreed, what
 * is still to do — is written by Claude in the owner's language, and letters,
 * messages and forms are worked on too. Without one, everything else still
 * works.
 */
import '../src/env.js';
import { ask, saveToEnv, say } from './terminal.js';

async function main(): Promise<void> {
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    say('An Anthropic API key is already saved in backend/.env — reports are written by Claude.');
    say('To change or remove it:  open -e .env');
    return;
  }
  if (!process.stdin.isTTY) {
    say('Run this in a Terminal window: it asks for your Anthropic API key.');
    process.exitCode = 1;
    return;
  }

  say('With an Anthropic API key, Claude writes the report on each call and works on');
  say('letters, messages and forms. Using the key costs a little per report.');
  say('  1. Open https://platform.claude.com and sign in (or create an account).');
  say('  2. Open "API keys", create a key and copy it. It starts with "sk-ant-".');
  say();
  const key = await ask('Paste the key here and press Enter (or just press Enter to stop): ');
  if (!key) {
    say('Nothing was saved.');
    return;
  }
  saveToEnv({ ANTHROPIC_API_KEY: key });
  say('Saved in backend/.env. The key stays on this computer.');
  say('Restart the server (npm start): its window will say "Reports: written by Claude".');
  say('From then on the app has to show the server\'s access key — scan the code in the');
  say('server\'s window once with the iPhone\'s Camera.');
}

main().catch((error) => {
  say(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
