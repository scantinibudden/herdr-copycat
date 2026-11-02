import { setHerdr, writes } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rect } from './fixtures/session.js';
import { layoutTab, findCut, rebuild } from '../lib/rebuild.js';

// Record splits instead of performing them; new panes are n1, n2, ...
function recorder() {
  const splits = [];
  const split = (id, options) => {
    splits.push([id, options.direction, Number(options.ratio.toFixed(2))]);
    return `n${splits.length}`;
  };
  return { splits, split };
}

test('rebuilds a nested "1 / 2 / 1" stack instead of flattening it', () => {
  const panes = [
    { rect: rect(0, 0, 120, 10) },
    { rect: rect(0, 10, 60, 20) },
    { rect: rect(60, 10, 60, 20) },
    { rect: rect(0, 30, 120, 10) },
  ];
  const { splits, split } = recorder();
  const ids = layoutTab('root', panes, split, () => {});
  assert.deepEqual(splits, [
    ['root', 'down', 0.25], // top row off the rest
    ['n1', 'down', 0.67], // middle row off the bottom row
    ['n1', 'right', 0.5], // middle row into two columns
  ]);
  assert.deepEqual(ids, ['root', 'n1', 'n3', 'n2']);
});

test('keeps split ratios from the saved sizes', () => {
  const { splits, split } = recorder();
  layoutTab('root', [{ rect: rect(0, 0, 36, 40) }, { rect: rect(36, 0, 84, 40) }], split, () => {});
  assert.deepEqual(splits, [['root', 'right', 0.3]]);
});

test('passes each new pane the folder of the region it anchors', () => {
  const cwds = [];
  const split = (id, options) => { cwds.push(options.cwd); return `n${cwds.length}`; };
  layoutTab('root', [{ rect: rect(0, 0, 60, 40), cwd: '/a' }, { rect: rect(60, 0, 60, 40), cwd: '/b' }], split, () => {});
  assert.deepEqual(cwds, ['/b']);
});

test('lays panes without sizes out as equal columns', () => {
  const { splits, split } = recorder();
  const ids = layoutTab('root', [{}, {}, {}], split, () => {});
  assert.deepEqual(splits, [['root', 'right', 0.33], ['n1', 'right', 0.5]]);
  assert.deepEqual(ids, ['root', 'n1', 'n2']);
});

test('a single pane needs no splits', () => {
  const { splits, split } = recorder();
  assert.deepEqual(layoutTab('root', [{ rect: rect(0, 0, 120, 40) }], split, () => {}), ['root']);
  assert.equal(splits.length, 0);
});

test('findCut returns null when nothing separates the panes', () => {
  assert.equal(findCut(rect(0, 0, 120, 40), [{ rect: rect(0, 0, 120, 40) }]), null);
});

test('a dry run plans the steps without touching herdr', () => {
  setHerdr({ snapshot: {} });
  const ws = {
    label: 'x', cwd: '/x', active_tab: 0, tabs: [
      { label: 'a', panes: [{ rect: rect(0, 0, 60, 40) }, { rect: rect(60, 0, 60, 40), command: { name: 'nvim', argv: ['nvim'] } }] },
      { label: 'b', panes: [{ rect: rect(0, 0, 120, 40), command: { name: 'sleep', argv: ['sleep', '9'] } }] },
    ],
  };
  const { actions } = rebuild(ws, { dryRun: true });
  assert.deepEqual(writes(), []);
  assert.deepEqual(actions.map((a) => a.action), ['workspace.create', 'tab.rename', 'split', 'tab.create', 'run', 'skip']);
});
