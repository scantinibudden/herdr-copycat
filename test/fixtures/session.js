// A herdr session for the fake CLI. Workspace w1 ("dev") has two tabs, listed in
// on-screen order with creation numbers reversed (the user dragged "logs" first):
//
//   tab "logs"  (number 2)  one pane: codex, resumable
//   tab "code"  (number 1)  a "1 / 2 / 1" stack:
//        ┌──────────── p1 claude ────────────┐  y 0..10
//        ├──── p2 nvim ─────┬──── p3 sleep ──┤  y 10..30
//        └──────────── p4 idle shell ────────┘  y 30..40
//
// Workspace w2 is an unrelated workspace that must never be captured.
export const CLAUDE_ID = '11111111-2222-3333-4444-555555555555';
export const CODEX_ID = '0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000';

export const rect = (x, y, width, height) => ({ x, y, width, height });

export function session() {
  return {
    snapshot: {
      focused_workspace_id: 'w1',
      workspaces: [
        { workspace_id: 'w1', number: 1, label: 'dev', active_tab_id: 'w1:t1' },
        { workspace_id: 'w2', number: 2, label: 'other', active_tab_id: 'w2:t1' },
      ],
      tabs: [
        { tab_id: 'w1:t2', workspace_id: 'w1', number: 2, label: 'logs' },
        { tab_id: 'w1:t1', workspace_id: 'w1', number: 1, label: 'code' },
        { tab_id: 'w2:t1', workspace_id: 'w2', number: 1, label: '1' },
      ],
      // Deliberately not in reading order.
      panes: [
        { pane_id: 'w1:p4', tab_id: 'w1:t1', workspace_id: 'w1', cwd: '/proj', label: 'shell' },
        { pane_id: 'w1:p3', tab_id: 'w1:t1', workspace_id: 'w1', cwd: '/proj' },
        { pane_id: 'w1:p1', tab_id: 'w1:t1', workspace_id: 'w1', cwd: '/proj', agent: 'claude',
          agent_session: { agent: 'claude', kind: 'id', source: 'herdr:claude', value: CLAUDE_ID } },
        { pane_id: 'w1:p2', tab_id: 'w1:t1', workspace_id: 'w1', cwd: '/proj/src' },
        { pane_id: 'w1:p5', tab_id: 'w1:t2', workspace_id: 'w1', cwd: '/proj/logs', agent: 'codex',
          agent_session: { agent: 'codex', kind: 'id', source: 'herdr:codex', value: CODEX_ID } },
        { pane_id: 'w2:p1', tab_id: 'w2:t1', workspace_id: 'w2', cwd: '/elsewhere' },
      ],
      layouts: [
        { tab_id: 'w1:t1', workspace_id: 'w1', panes: [
          { pane_id: 'w1:p1', rect: rect(0, 0, 120, 10) },
          { pane_id: 'w1:p2', rect: rect(0, 10, 60, 20) },
          { pane_id: 'w1:p3', rect: rect(60, 10, 60, 20) },
          { pane_id: 'w1:p4', rect: rect(0, 30, 120, 10) },
        ] },
        { tab_id: 'w1:t2', workspace_id: 'w1', panes: [{ pane_id: 'w1:p5', rect: rect(0, 0, 120, 40) }] },
        { tab_id: 'w2:t1', workspace_id: 'w2', panes: [{ pane_id: 'w2:p1', rect: rect(0, 0, 120, 40) }] },
      ],
    },
    process_info: {
      'w1:p1': fg(10, ['/opt/claude-code/bin/claude', '--resume', CLAUDE_ID], 'claude'),
      'w1:p2': fg(20, ['nvim', 'main.rs'], 'nvim'),
      'w1:p3': fg(30, ['sleep', '600'], 'sleep'),
      // p4: an idle shell (no entry -> the fake reports the shell itself)
      'w1:p5': fg(50, ['/usr/bin/codex', 'resume', CODEX_ID], 'codex'),
    },
  };
}

// process_info for a pane whose shell (pid `base`) runs `argv` in the foreground.
function fg(base, argv, name) {
  return {
    shell_pid: base,
    foreground_process_group_id: base + 1,
    foreground_processes: [{ pid: base + 1, name, argv, cmdline: argv.join(' '), cwd: '/proj' }],
  };
}

