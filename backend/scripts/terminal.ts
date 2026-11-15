/**
 * What the setup scripts share: talking to the person at the Terminal, and
 * keeping what they answer in backend/.env — their private settings file.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const ENV_FILE = '.env';

export function say(message = ''): void {
  console.log(message);
}

/** Asks a question in the Terminal window and waits for the answer. */
export async function ask(question: string): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await terminal.question(question)).trim();
  } finally {
    terminal.close();
  }
}

/**
 * Sets KEY=value in backend/.env, replacing an existing line or adding one.
 * A first .env starts as a copy of .env.example, so every setting is there
 * to be read, with its explanation.
 */
export function saveToEnv(values: Record<string, string>): void {
  let text = existsSync(ENV_FILE)
    ? readFileSync(ENV_FILE, 'utf8')
    : existsSync('.env.example')
      ? readFileSync('.env.example', 'utf8')
      : '';
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    // A function, so that a "$" in a value is not read as a replacement pattern.
    text = pattern.test(text)
      ? text.replace(pattern, () => line)
      : `${text.replace(/\n*$/, '\n')}${line}\n`;
  }
  writeFileSync(ENV_FILE, text);
}
