// User settings in $HERDR_PLUGIN_CONFIG_DIR/settings.json, written with the
// defaults the first time they are read.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './paths.js';

export const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');

export const DEFAULTS = {
  // What agent panes do when a space opens:
  //   "resume": rejoin the conversation the agent had when the space was saved
  //   "fresh":  start a new conversation, e.g. for spaces used as templates
  agents: 'resume',
};

function read() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, `${JSON.stringify(DEFAULTS, null, 2)}\n`);
    }
    return {};
  }
}

const cache = new Map();

export function loadSettings() {
  if (!cache.has('settings')) {
    const settings = { ...DEFAULTS, ...read() };
    if (settings.agents !== 'fresh') settings.agents = 'resume';
    cache.set('settings', settings);
  }
  return cache.get('settings');
}
