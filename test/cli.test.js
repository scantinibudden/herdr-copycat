import { scratch, setHerdr, calls } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { session } from './fixtures/session.js';

const CLI = fileURLToPath(new URL('../bin/copycat.js', import.meta.url));
const run = (...arguments_) => spawnSync(process.execPath, [CLI, ...arguments_], { encoding: 'utf8', env: process.env });

test('prints usage for an unknown command', () => {
  const r = run('frobnicate');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: copycat/);
});

test('save needs a name', () => {
  setHerdr(session());
  const r = run('save');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /name is required/);
});

test('save, list, dry-run open and delete through the CLI', () => {
  setHerdr(session());
  assert.match(run('save', 'my', 'space', '--workspace', 'w1').stdout, /saved "my space": 2 tabs, 5 panes \(2 agents, 2 programs\)/);
  assert.match(run('list').stdout, /^my space\n {2}2 tabs, 5 panes/);
  assert.match(run('list', '--picker').stdout, /^my-space\tmy space {2}· {2}2 tabs/);
  const dry = run('open', 'my space', '--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /would open "my space" \(dry run\)/);
  assert.match(run('delete', 'my-space').stdout, /deleted "my space"/);
  assert.match(run('list').stdout, /no saved spaces yet/);
});

test('capture now, save later: what the overlay flow does', () => {
  setHerdr(session());
  const cap = run('capture', '--workspace', 'w1');
  assert.equal(cap.status, 0, cap.stderr);
  const file = path.join(scratch, 'capture.json');
  fs.writeFileSync(file, cap.stdout);

  // The session changes before the name is typed (the overlay opens); the space
  // must still be the workspace as it was at capture time.
  setHerdr({ snapshot: { workspaces: [], tabs: [], panes: [], layouts: [] } });
  assert.match(run('save', 'later', '--from', file).stdout, /saved "later": 2 tabs, 5 panes/);
  assert.equal(calls().length, 0, 'saving a capture does not query herdr');
  run('delete', 'later');
});
