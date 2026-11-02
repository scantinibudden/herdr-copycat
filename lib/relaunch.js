// What to type into a pane when a space opens: the agent that was there, a program
// from the user's relaunch list, or nothing (the pane stays a plain shell).
import fs from 'node:fs';
import path from 'node:path';
import { loadSettings } from './settings.js';
import { CONFIG_DIR, PLUGIN_ROOT } from './paths.js';

const LIST_FILE = path.join(CONFIG_DIR, 'relaunch.txt');
const DEFAULT_LIST_FILE = path.join(PLUGIN_ROOT, 'config', 'relaunch.default.txt');

// A pane running one of these is idle: there is nothing to relaunch.
const SHELLS = new Set(['sh', 'bash', 'zsh', 'fish', 'dash', 'ksh', 'mksh', 'tcsh', 'csh', 'nu', 'elvish', 'xonsh', 'pwsh']);

// How each agent resumes a conversation, from herdr's "native agent session restore"
// table (https://herdr.dev/docs). Keyed by herdr's agent name: [executable, flag].
// A flag ending in "=" takes its value without a space.
export const AGENTS = {
  agy: ['agy', '--conversation'],
  claude: ['claude', '--resume'],
  codex: ['codex', 'resume'],
  copilot: ['copilot', '--resume='],
  cursor: ['cursor-agent', '--resume'],
  devin: ['devin', '--resume'],
  droid: ['droid', '--resume'],
  grok: ['grok', '--resume'],
  hermes: ['hermes', '--resume'],
  kilo: ['kilo', '--session'],
  kimi: ['kimi', '--session'],
  letta: ['letta', '--conversation'],
  mastracode: ['mastracode', '--thread'],
  omp: ['omp', '--resume='],
  opencode: ['opencode', '--session'],
  pi: ['pi', '--session'],
  qodercli: ['qodercli', '--resume'],
  qwen: ['qwen', '--resume'],
};

// Quote a word for a POSIX shell, leaving plain words as they are.
export const shellQuote = (word) =>
  (/^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replaceAll("'", String.raw`'\''`)}'`);

export const programName = (process_) =>
  path.basename(String(process_?.argv?.[0] || process_?.name || '')).replace(/^-/, '');

export const isShell = (process_) => SHELLS.has(programName(process_));

function readList() {
  if (!fs.existsSync(LIST_FILE) && fs.existsSync(DEFAULT_LIST_FILE)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.copyFileSync(DEFAULT_LIST_FILE, LIST_FILE); // the user edits their own copy
  }
  const file = fs.existsSync(LIST_FILE) ? LIST_FILE : DEFAULT_LIST_FILE;
  if (!fs.existsSync(file)) return new Set();
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  return new Set(lines.map((line) => line.replace(/#.*/, '').trim()).filter(Boolean));
}

const cache = new Map();
function relaunchList() {
  if (!cache.has('list')) cache.set('list', readList());
  return cache.get('list');
}

function agentCommand(agent) {
  const [executable, flag] = AGENTS[agent.name] || [agent.name];
  const id = agent.session?.value;
  if (!flag || !id || loadSettings().agents === 'fresh') return executable;
  // letta stores the default conversation of an agent as "default:<agent-id>"
  if (agent.name === 'letta' && id.startsWith('default:')) {
    return `letta --conversation default --agent ${shellQuote(id.slice('default:'.length))}`;
  }
  return flag.endsWith('=') ? `${executable} ${shellQuote(flag + id)}` : `${executable} ${flag} ${shellQuote(id)}`;
}

// The command for a captured pane, or null to leave it as a shell.
export function commandFor(pane) {
  if (pane.agent) return agentCommand(pane.agent);
  const program = pane.command;
  if (!program) return null;
  const list = relaunchList();
  if (!list.has('*') && !list.has(programName(program))) return null;
  if (program.argv?.length) return program.argv.map((word) => shellQuote(String(word))).join(' ');
  return program.cmdline || null;
}
