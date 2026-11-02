// Calls the herdr CLI and returns its parsed `result`. herdr hands every plugin
// process HERDR_BIN_PATH and HERDR_SOCKET_PATH, so the CLI reaches the right server.
import { spawnSync } from 'node:child_process';

const ATTEMPTS = 3;

export class HerdrError extends Error {
  constructor(argv, message, code) {
    super(`herdr ${argv.slice(0, 2).join(' ')}: ${message}`);
    this.name = 'HerdrError';
    this.code = code;
  }
}

// A request can fail when the socket is busy with many quick calls in a row;
// those failures mention the connection, and a short retry succeeds.
const isFlaky = (text) => /broken ?pipe|connection reset|would ?block/i.test(text);

export function pause(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function call(argv) {
  const binary = process.env.HERDR_BIN_PATH || 'herdr';
  for (let attempt = 1; ; attempt++) {
    const child = spawnSync(binary, argv, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (child.error) throw new HerdrError(argv, child.error.message, 'spawn_failed');
    const text = `${child.stdout}${child.stderr}`.trim();
    if (child.status !== 0 && attempt < ATTEMPTS && isFlaky(text)) {
      pause(100 * attempt);
      continue;
    }
    if (text === '' && child.status === 0) return null; // e.g. `pane run` prints nothing
    const start = Math.max(0, text.indexOf('{')); // tolerate a line printed before the JSON
    let body;
    try {
      body = JSON.parse(text.slice(start));
    } catch {
      throw new HerdrError(argv, `unexpected output: ${text.slice(0, 200)}`, 'bad_output');
    }
    if (body.error) throw new HerdrError(argv, body.error.message, body.error.code);
    return body.result;
  }
}

const option = (flag, value) => (value ? [flag, String(value)] : []);

export const snapshot = () => call(['api', 'snapshot']).snapshot;

export const processInfo = (paneId) => call(['pane', 'process-info', '--pane', paneId]).process_info;

export const createWorkspace = ({ cwd, label }) =>
  call(['workspace', 'create', '--no-focus', ...option('--cwd', cwd), ...option('--label', label)]);

export const createTab = ({ workspace, cwd, label }) =>
  call(['tab', 'create', '--no-focus', ...option('--workspace', workspace), ...option('--cwd', cwd), ...option('--label', label)]);

export const splitPane = (paneId, { direction, ratio, cwd }) =>
  call(['pane', 'split', paneId, '--direction', direction, '--ratio', String(ratio), '--no-focus', ...option('--cwd', cwd)]).pane;

export const runInPane = (paneId, command) => call(['pane', 'run', paneId, command]);

export const renamePane = (paneId, label) => call(['pane', 'rename', paneId, label]);

export const renameTab = (tabId, label) => call(['tab', 'rename', tabId, label]);

export const focusTab = (tabId) => call(['tab', 'focus', tabId]);

export const focusWorkspace = (workspaceId) => call(['workspace', 'focus', workspaceId]);
