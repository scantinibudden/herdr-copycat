import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAUDE_ID } from './fixtures/session.js';
import { commandFor, isShell, shellQuote, AGENTS } from '../lib/relaunch.js';

const agent = (name, value) => ({ agent: { name, session: value ? { value } : null } });

test('agents resume their saved conversation', () => {
  assert.equal(commandFor(agent('claude', CLAUDE_ID)), `claude --resume ${CLAUDE_ID}`);
  assert.equal(commandFor(agent('codex', 'abc')), 'codex resume abc');
  assert.equal(commandFor(agent('cursor', 'abc')), 'cursor-agent --resume abc', 'herdr\'s cursor runs as cursor-agent');
  assert.equal(commandFor(agent('copilot', 'abc')), 'copilot --resume=abc', 'flags ending in = take the value directly');
  assert.equal(commandFor(agent('pi', '/s/my session.jsonl')), "pi --session '/s/my session.jsonl'");
});

test('letta default conversations resume through the agent id', () => {
  assert.equal(commandFor(agent('letta', 'default:agent-42')), 'letta --conversation default --agent agent-42');
  assert.equal(commandFor(agent('letta', 'conv-1')), 'letta --conversation conv-1');
});

test('agents without a session, or without a resume flag, start fresh', () => {
  assert.equal(commandFor(agent('claude', null)), 'claude');
  assert.equal(commandFor(agent('gemini', 'abc')), 'gemini');
  assert.equal(commandFor(agent('cursor', null)), 'cursor-agent');
});

test('the agent table covers herdr\'s resumable agents', () => {
  assert.equal(Object.keys(AGENTS).length, 18);
});

test('programs restart only when they are on the relaunch list', () => {
  assert.equal(commandFor({ command: { name: 'nvim', argv: ['nvim', 'main.rs'] } }), 'nvim main.rs');
  assert.equal(commandFor({ command: { name: 'nvim', argv: ['/usr/bin/nvim', 'a b.txt'] } }), "/usr/bin/nvim 'a b.txt'");
  assert.equal(commandFor({ command: { name: 'tail', argv: null, cmdline: 'tail -f log' } }), 'tail -f log');
  assert.equal(commandFor({ command: { name: 'sleep', argv: ['sleep', '600'] } }), null);
  assert.equal(commandFor({}), null);
});

test('shells count as idle, login shells included', () => {
  assert.ok(isShell({ name: 'zsh', argv: ['/usr/bin/zsh'] }));
  assert.ok(isShell({ name: 'bash', argv: ['-bash'] }));
  assert.ok(!isShell({ name: 'nvim', argv: ['nvim'] }));
});

test('shellQuote leaves plain words alone and quotes the rest', () => {
  assert.equal(shellQuote('main.rs'), 'main.rs');
  assert.equal(shellQuote('a b'), "'a b'");
  assert.equal(shellQuote("it's"), String.raw`'it'\''s'`);
  assert.equal(shellQuote('$(rm -rf ~)'), "'$(rm -rf ~)'");
});
