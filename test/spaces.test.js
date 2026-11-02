import { scratch, setHerdr, writes } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { session, CLAUDE_ID, CODEX_ID } from './fixtures/session.js';
import * as spaces from '../lib/spaces.js';

test('slugify makes safe, stable file names', () => {
  assert.equal(spaces.slugify('  My Dev Space! '), 'my-dev-space');
  assert.equal(spaces.slugify('../../etc/passwd'), 'etc-passwd');
  assert.equal(spaces.slugify('***'), 'space');
});

test('save, list, open and delete a space end to end', () => {
  setHerdr(session());
  const saved = spaces.save('Dev Setup', { workspaceId: 'w1' });
  assert.equal(saved.slug, 'dev-setup');
  assert.deepEqual(saved.summary, { tabs: 2, panes: 5, commands: 2, agents: 2 });

  const document = JSON.parse(fs.readFileSync(saved.file, 'utf8'));
  assert.equal(document.tool, 'herdr-copycat');
  assert.equal(document.name, 'Dev Setup');

  assert.deepEqual(spaces.list().map((s) => s.name), ['Dev Setup']);

  setHerdr(session());
  spaces.open('dev setup'); // display names match case-insensitively
  const w = writes();
  const has = (...prefix) => w.some((c) => prefix.every((p, index) => c[index] === p));

  assert.deepEqual(w[0], ['workspace', 'create', '--no-focus', '--cwd', '/proj/logs', '--label', 'dev']);
  assert.ok(has('tab', 'rename', 'nw1:t1', 'logs'), 'the root tab takes the first tab\'s name');
  assert.ok(has('tab', 'create', '--no-focus', '--workspace', 'nw1', '--cwd', '/proj', '--label', 'code'));
  assert.deepEqual(w.filter((c) => c[1] === 'split').map((c) => [c[2], c[4], c[6]]),
    [['nt2:p1', 'down', '0.25'], ['np3', 'down', '0.6666666666666666'], ['np3', 'right', '0.5']]);
  assert.ok(has('pane', 'run', 'nw1:p1', `codex resume ${CODEX_ID}`));
  assert.ok(has('pane', 'run', 'nt2:p1', `claude --resume ${CLAUDE_ID}`));
  assert.ok(has('pane', 'run', 'np3', 'nvim main.rs'));
  assert.ok(w.every((c) => !(c[1] === 'run' && /sleep/.test(c[3]))), 'sleep is not on the allowlist');
  assert.ok(has('pane', 'rename', 'np4', 'shell'));
  assert.ok(has('tab', 'focus', 'nt2'), 'the saved active tab gets focus');
  assert.deepEqual(w.at(-1), ['workspace', 'focus', 'nw1']);

  spaces.remove('Dev Setup');
  assert.deepEqual(spaces.list(), []);
});

test('saving under an existing name replaces that space', () => {
  setHerdr(session());
  spaces.save('again', { workspaceId: 'w1' });
  spaces.save('Again', { workspaceId: 'w1' });
  assert.equal(spaces.list().length, 1);
  spaces.remove('again');
});

test('errors are clear for missing names and spaces', () => {
  setHerdr(session());
  assert.throws(() => spaces.save('  ', { workspaceId: 'w1' }), /name is required/);
  assert.throws(() => spaces.open('nope'), /no saved space named "nope"/);
  assert.throws(() => spaces.remove('nope'), /no saved space named "nope"/);
});

test('imports spaces saved by herdr-resurrect and skips duplicates', () => {
  const directory = path.join(scratch, 'resurrect-spaces');
  fs.mkdirSync(directory, { recursive: true });
  const resurrectSpace = {
    tool: 'herdr-resurrect', kind: 'space', name: 'Old One', saved_at: '2026-08-01T00:00:00.000Z',
    workspaces: [{
      workspace_id: 'w3', number: 3, label: 'old', active_tab_id: 'w3:t2', cwd: '/old',
      tabs: [
        { tab_id: 'w3:t1', number: 1, label: 'one', panes: [{ pane_id: 'w3:p1', cwd: '/old', rect: null }] },
        { tab_id: 'w3:t2', number: 2, label: 'two', panes: [{ pane_id: 'w3:p2', cwd: '/old',
          command: { name: 'htop', argv: ['htop'], cmdline: 'htop', restorable: true } }] },
      ],
    }],
  };
  fs.writeFileSync(path.join(directory, 'old-one.json'), JSON.stringify(resurrectSpace));
  fs.writeFileSync(path.join(directory, 'broken.json'), '{ not json');

  assert.deepEqual(spaces.importResurrect(directory), { imported: ['Old One'], skipped: [] });
  assert.deepEqual(spaces.importResurrect(directory), { imported: [], skipped: ['Old One'] });

  const loaded = spaces.load('Old One');
  assert.equal(loaded.workspace.active_tab, 1);
  assert.deepEqual(loaded.workspace.tabs.map((t) => t.label), ['one', 'two']);
  assert.equal(JSON.parse(fs.readFileSync(loaded.file, 'utf8')).tool, 'herdr-copycat');
  spaces.remove('Old One');
});

test('importing from a missing folder is a no-op', () => {
  assert.deepEqual(spaces.importResurrect(path.join(scratch, 'does-not-exist')), { imported: [], skipped: [] });
});
