import { setHerdr } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { session, CLAUDE_ID, CODEX_ID } from './fixtures/session.js';
import { captureWorkspace } from '../lib/capture.js';

test('captures only the requested workspace, keeping on-screen tab order', () => {
  setHerdr(session());
  const ws = captureWorkspace('w1');
  assert.equal(ws.label, 'dev');
  assert.deepEqual(ws.tabs.map((t) => t.label), ['logs', 'code']);
  assert.equal(ws.active_tab, 1, 'active tab is "code", the second on screen');
  assert.equal(ws.cwd, '/proj/logs', 'the workspace opens in its first pane\'s folder');
});

test('defaults to the focused workspace and rejects unknown ones', () => {
  setHerdr(session());
  assert.equal(captureWorkspace().label, 'dev');
  assert.throws(() => captureWorkspace('w9'), /w9 is not in this herdr session/);
});

test('orders panes top-to-bottom, left-to-right with their rects', () => {
  setHerdr(session());
  const code = captureWorkspace('w1').tabs[1];
  assert.deepEqual(code.panes.map((p) => [p.rect.x, p.rect.y]), [[0, 0], [0, 10], [60, 10], [0, 30]]);
  assert.equal(code.panes[1].cwd, '/proj/src');
  assert.equal(code.panes[3].label, 'shell');
});

test('records agents with their session and programs, but not idle shells', () => {
  setHerdr(session());
  const [logs, code] = captureWorkspace('w1').tabs;
  assert.deepEqual(code.panes[0].agent, { name: 'claude', session: { value: CLAUDE_ID } });
  assert.deepEqual(logs.panes[0].agent, { name: 'codex', session: { value: CODEX_ID } });
  assert.deepEqual(code.panes[1].command, { name: 'nvim', argv: ['nvim', 'main.rs'], cmdline: 'nvim main.rs' });
  assert.equal(code.panes[2].command.name, 'sleep', 'programs off the relaunch list are still recorded');
  assert.equal(code.panes[3].command, undefined);
  assert.equal(code.panes[3].agent, undefined);
});

test('an agent herdr reports no session for is saved without one', () => {
  const state = session();
  delete state.snapshot.panes.find((p) => p.pane_id === 'w1:p5').agent_session;
  setHerdr(state);
  assert.deepEqual(captureWorkspace('w1').tabs[0].panes[0].agent, { name: 'codex', session: null });
});

test('a pane whose process info is unavailable is saved as a plain shell', () => {
  const state = session();
  state.process_info['w1:p2'] = { error: true }; // the fake returns no processes
  setHerdr(state);
  assert.equal(captureWorkspace('w1').tabs[1].panes[1].command, undefined);
});
