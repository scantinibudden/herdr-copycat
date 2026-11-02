// Shared test setup: a private state/config directory and the fake herdr CLI. Import
// this before any lib module: the libs read these variables when they load, and
// imports run in the order they are written.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'copycat-test-'));
const stateFile = path.join(scratch, 'herdr-state.json');
const logFile = path.join(scratch, 'herdr.log');

process.env.HERDR_PLUGIN_STATE_DIR = path.join(scratch, 'state');
process.env.HERDR_PLUGIN_CONFIG_DIR = path.join(scratch, 'config');
process.env.HERDR_PLUGIN_ROOT = path.resolve(here, '..');
process.env.HERDR_BIN_PATH = path.join(here, 'fixtures', 'fake-herdr.js');
process.env.FAKE_HERDR_STATE = stateFile;
process.env.FAKE_HERDR_LOG = logFile;
delete process.env.HERDR_WORKSPACE_ID;
delete process.env.HERDR_COPYCAT_ORIGIN_WS;

// Point the fake herdr at a session: { snapshot, process_info }.
export function setHerdr(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state));
  fs.rmSync(logFile, { force: true });
  fs.rmSync(`${logFile}.n`, { force: true });
}

// Every herdr call made since the last setHerdr(), as argv arrays.
export function calls() {
  const lines = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n') : [];
  return lines.filter(Boolean).map((line) => JSON.parse(line));
}

const READS = new Set(['api snapshot', 'pane process-info']);

// The calls that change something in herdr.
export const writes = () => calls().filter((argv) => !READS.has(argv.slice(0, 2).join(' ')));
