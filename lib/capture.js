// Capture one live herdr workspace as plain JSON: its tabs in on-screen order and,
// per tab, each pane's size and place, folder, label and what was running in it.
import * as herdr from './herdr.js';
import { isShell } from './relaunch.js';

// What the pane is running in the foreground, or null when it's at a shell prompt.
function runningProgram(paneId) {
  let info;
  try {
    info = herdr.processInfo(paneId);
  } catch {
    return null; // the pane closed while we were looking
  }
  const programs = (info?.foreground_processes || []).filter((program) => program.pid !== info.shell_pid);
  const program = programs.find((candidate) => candidate.pid === info.foreground_process_group_id) || programs.at(-1);
  return program && !isShell(program) ? program : null;
}

// Reading order: rows top to bottom, then left to right within a row.
const byPosition = (a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x;

function capturePane({ live, rect }) {
  const pane = { label: live.label || null, cwd: live.cwd || live.foreground_cwd || null, rect };
  if (live.agent) {
    const id = live.agent_session?.value;
    pane.agent = { name: live.agent, session: id ? { value: id } : null };
    return pane;
  }
  const program = runningProgram(live.pane_id);
  if (program) pane.command = { name: program.name || null, argv: program.argv || null, cmdline: program.cmdline || null };
  return pane;
}

function captureTab(snap, tab) {
  const layout = (snap.layouts || []).find((candidate) => candidate.tab_id === tab.tab_id);
  const rects = new Map((layout?.panes || []).map((pane) => [pane.pane_id, pane.rect]));
  const panes = (snap.panes || [])
    .filter((pane) => pane.tab_id === tab.tab_id)
    .map((pane) => ({ live: pane, rect: rects.get(pane.pane_id) || null }));
  const ordered = panes.every((pane) => pane.rect) ? panes.toSorted(byPosition) : panes;
  return { label: tab.label || null, panes: ordered.map((pane) => capturePane(pane)) };
}

// Capture a workspace by id, or the focused one.
export function captureWorkspace(workspaceId) {
  const snap = herdr.snapshot();
  const id = workspaceId || snap.focused_workspace_id;
  const ws = (snap.workspaces || []).find((candidate) => candidate.workspace_id === id);
  if (!ws) throw new Error(`workspace ${id || '(focused)'} is not in this herdr session`);

  // The snapshot lists tabs in on-screen order. A tab's `number` is when it was
  // created, so sorting by it would undo any reordering.
  const tabs = (snap.tabs || []).filter((tab) => tab.workspace_id === ws.workspace_id);
  const captured = tabs.map((tab) => captureTab(snap, tab));
  return {
    label: ws.label || null,
    cwd: captured[0]?.panes[0]?.cwd || null,
    active_tab: Math.max(0, tabs.findIndex((tab) => tab.tab_id === ws.active_tab_id)),
    tabs: captured,
  };
}
