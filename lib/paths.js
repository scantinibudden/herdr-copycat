// Where copycat keeps saved spaces and user config. herdr hands every plugin process
// HERDR_PLUGIN_STATE_DIR / HERDR_PLUGIN_CONFIG_DIR; the fallbacks let the CLI run by
// hand (e.g. `node bin/copycat.js list`). Spaces are a library picked by name, so
// they are shared by every herdr session rather than scoped to one.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = process.env.HERDR_PLUGIN_ROOT || fileURLToPath(new URL('..', import.meta.url));

export const STATE_DIR = process.env.HERDR_PLUGIN_STATE_DIR || path.join(os.homedir(), '.local', 'state', 'herdr-copycat');

export const CONFIG_DIR = process.env.HERDR_PLUGIN_CONFIG_DIR || path.join(os.homedir(), '.config', 'herdr-copycat');

export const SPACES_DIR = path.join(STATE_DIR, 'spaces');
