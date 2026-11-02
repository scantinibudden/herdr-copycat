#!/usr/bin/env node
// A stand-in for the herdr CLI. Tests point HERDR_BIN_PATH at this file.
//   FAKE_HERDR_STATE  JSON file: { snapshot, process_info: { <pane_id>: {...} } }
//   FAKE_HERDR_LOG    every call is appended here as one JSON array per line
// Reads come from the state file; writes return plausible ids and are only logged.
// Panes the fake creates always report an idle shell.
import fs from 'node:fs';

const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_HERDR_LOG, `${JSON.stringify(argv)}\n`);
const state = JSON.parse(fs.readFileSync(process.env.FAKE_HERDR_STATE, 'utf8'));

// Ids keep counting up across calls; the counter lives next to the log.
const counterFile = `${process.env.FAKE_HERDR_LOG}.n`;
function nextId() {
  const id = fs.existsSync(counterFile) ? Number(fs.readFileSync(counterFile, 'utf8')) + 1 : 1;
  fs.writeFileSync(counterFile, String(id));
  return id;
}

const reply = (result) => process.stdout.write(`${JSON.stringify({ id: 'fake', result })}\n`);
const idleShell = (paneId) => ({ pane_id: paneId, shell_pid: 1, foreground_process_group_id: 1, foreground_processes: [{ pid: 1, name: 'zsh' }] });

switch (argv.slice(0, 2).join(' ')) {
  case 'api snapshot': {
    reply({ snapshot: state.snapshot });
    break;
  }
  case 'pane process-info': {
    const paneId = argv[argv.indexOf('--pane') + 1];
    reply({ process_info: state.process_info?.[paneId] || idleShell(paneId) });
    break;
  }
  case 'workspace create': {
    const id = nextId();
    reply({ workspace: { workspace_id: `nw${id}` }, tab: { tab_id: `nw${id}:t1` }, root_pane: { pane_id: `nw${id}:p1` } });
    break;
  }
  case 'tab create': {
    const id = nextId();
    reply({ tab: { tab_id: `nt${id}` }, root_pane: { pane_id: `nt${id}:p1` } });
    break;
  }
  case 'pane split': {
    reply({ pane: { pane_id: `np${nextId()}` } });
    break;
  }
  case 'pane run': { // like the real CLI, prints nothing on success
    break;
  }
  default: { // rename, focus: nothing worth reporting
    reply({ type: 'ok' });
  }
}
