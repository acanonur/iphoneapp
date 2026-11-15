/**
 * Reads backend/.env — the owner's private settings file — if there is one.
 * Imported first by anything that is started from the command line, so the
 * settings are in place before the rest looks at them. Values already set in
 * the shell win, which is how a one-off "PORT=9000 npm start" works.
 */
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
