// Settings are read once per process, so the cases that need their own settings
// live in this file, which writes them before loading the module under test.
import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const configDirectory = process.env.HERDR_PLUGIN_CONFIG_DIR;
fs.mkdirSync(configDirectory, { recursive: true });
fs.writeFileSync(path.join(configDirectory, 'settings.json'), JSON.stringify({ agents: 'fresh' }));
fs.writeFileSync(path.join(configDirectory, 'relaunch.txt'), '# everything\n*\n');

const { commandFor } = await import('../lib/relaunch.js');

test('agents = "fresh" starts agents without resuming', () => {
  assert.equal(commandFor({ agent: { name: 'claude', session: { value: 'abc' } } }), 'claude');
  assert.equal(commandFor({ agent: { name: 'cursor', session: null } }), 'cursor-agent');
});

test('a relaunch list of * restarts every program', () => {
  assert.equal(commandFor({ command: { name: 'sleep', argv: ['sleep', '600'] } }), 'sleep 600');
});
