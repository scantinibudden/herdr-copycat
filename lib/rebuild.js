// Rebuild a captured workspace as a brand-new herdr workspace: create it and its
// tabs, reproduce each tab's splits from the saved pane rects, then start agents and
// listed programs again in their panes.
import * as herdr from './herdr.js';
import { commandFor } from './relaunch.js';

// --- Layout -------------------------------------------------------------------
// herdr tab layouts are guillotine trees (every split is one horizontal or vertical
// cut), so a tab's pane rects fully determine the tree. Find the outermost cut,
// split the live pane there, and recurse: this reproduces nested layouts such as a
// "1 / 2 / 1" stack that a linear chain of splits would flatten.
const EPS = 2; // cell tolerance for borders

function boundingBox(rects) {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// Top-left-most pane of a group: it stays put through every split of its region,
// so its cwd is the one to give the new pane that anchors that region.
const anchorPane = (group) => group.toSorted((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)[0];

// The first clean cut of `region` that separates `group` into two, or null.
export function findCut(region, group) {
  const candidates = [];
  for (const pane of group) {
    const right = pane.rect.x + pane.rect.width;
    if (right > region.x + EPS && right < region.x + region.width - EPS &&
        group.every((other) => other.rect.x + other.rect.width <= right + EPS || other.rect.x >= right - EPS)) {
      candidates.push({ direction: 'right', at: right });
    }
    const bottom = pane.rect.y + pane.rect.height;
    if (bottom > region.y + EPS && bottom < region.y + region.height - EPS &&
        group.every((other) => other.rect.y + other.rect.height <= bottom + EPS || other.rect.y >= bottom - EPS)) {
      candidates.push({ direction: 'down', at: bottom });
    }
  }
  if (candidates.length === 0) return null;
  const { direction, at } = candidates.toSorted((a, b) => a.at - b.at)[0];
  if (direction === 'right') {
    const kept = group.filter((pane) => pane.rect.x + pane.rect.width <= at + EPS);
    return {
      direction, kept, added: group.filter((pane) => !kept.includes(pane)),
      keptRegion: { x: region.x, y: region.y, width: at - region.x, height: region.height },
      addedRegion: { x: at, y: region.y, width: region.x + region.width - at, height: region.height },
    };
  }
  const kept = group.filter((pane) => pane.rect.y + pane.rect.height <= at + EPS);
  return {
    direction, kept, added: group.filter((pane) => !kept.includes(pane)),
    keptRegion: { x: region.x, y: region.y, width: region.width, height: at - region.y },
    addedRegion: { x: region.x, y: at, width: region.width, height: region.y + region.height - at },
  };
}

// Not a guillotine layout (herdr never makes one): keep the first pane, cut off the rest.
const fallbackCut = (region, group) => ({
  direction: 'right', kept: group.slice(0, 1), added: group.slice(1),
  keptRegion: { ...region, width: region.width / 2 },
  addedRegion: { ...region, x: region.x + region.width / 2, width: region.width / 2 },
});

// Spaces from older tools can lack rects; lay those panes out as equal columns.
const withRects = (panes) => (panes.every((pane) => pane.rect)
  ? panes
  : panes.map((pane, column) => ({ ...pane, rect: { x: column * 10, y: 0, width: 10, height: 10 } })));

// Split live pane `rootId` until it matches `panes`; returns live pane ids in the
// order of `panes`. `split(id, { direction, ratio, cwd })` returns the new pane id;
// herdr's ratio is the share the KEPT (left/top) pane gets.
export function layoutTab(rootId, panes, split, note) {
  const boxes = withRects(panes);
  const ids = boxes.map(() => rootId);
  const place = (region, group, liveId) => {
    if (group.length === 1) {
      ids[boxes.indexOf(group[0])] = liveId;
      return;
    }
    const cut = findCut(region, group) || fallbackCut(region, group);
    const ratio = cut.direction === 'right' ? cut.keptRegion.width / region.width : cut.keptRegion.height / region.height;
    note('split', `${liveId} ${cut.direction} @${ratio.toFixed(2)}`);
    const newId = split(liveId, { direction: cut.direction, ratio, cwd: anchorPane(cut.added).cwd });
    place(cut.keptRegion, cut.kept, liveId); // the kept side is the original pane (left / top)
    place(cut.addedRegion, cut.added, newId); // the added side is the new pane (right / bottom)
  };
  if (boxes.length > 0) place(boundingBox(boxes.map((pane) => pane.rect)), boxes, rootId);
  return ids;
}

// --- Starting programs ----------------------------------------------------------
function atPrompt(paneId) {
  try {
    const info = herdr.processInfo(paneId);
    return (info.foreground_processes || []).every((program) => program.pid === info.shell_pid);
  } catch {
    return false;
  }
}

// A pane we just created starts a shell that isn't ready instantly: while it
// sources its rc files it briefly shows a non-shell foreground process. Wait for
// the prompt before typing, so the command isn't swallowed by shell start-up.
function waitForShellReady(paneId, tries = 30, delay = 150) {
  for (let attempt = 0; attempt < tries; attempt++) {
    if (atPrompt(paneId)) return true;
    herdr.pause(delay);
  }
  return false;
}

// --- Open -----------------------------------------------------------------------
// The live tab for saved tab `index`: a new workspace already has one tab, which
// the first saved tab takes over; the others are created.
function openTab(context, tab, index) {
  const { ws, created, workspaceId, dryRun, note, placeholder } = context;
  if (index === 0) {
    const tabId = created ? created.tab.tab_id : placeholder('tab');
    if (tab.label) {
      note('tab.rename', `${tabId} -> "${tab.label}"`);
      if (!dryRun) herdr.renameTab(tabId, tab.label);
    }
    return { tabId, rootId: created ? created.root_pane.pane_id : placeholder('pane') };
  }
  note('tab.create', `"${tab.label || ''}"`);
  if (dryRun) return { tabId: placeholder('tab'), rootId: placeholder('pane') };
  const made = herdr.createTab({ workspace: workspaceId, cwd: tab.panes[0]?.cwd || ws.cwd, label: tab.label });
  return { tabId: made.tab.tab_id, rootId: made.root_pane.pane_id };
}

function fillPane({ dryRun, note }, id, pane) {
  if (pane.label) {
    note('pane.rename', `${id} -> "${pane.label}"`);
    if (!dryRun) herdr.renamePane(id, pane.label);
  }
  const command = commandFor(pane);
  if (command) {
    note('run', `${id} <- ${command}`);
    if (!dryRun) {
      waitForShellReady(id); // best effort: type it even if the prompt never shows
      herdr.runInPane(id, command);
    }
  } else if (pane.command) {
    note('skip', `${id} (${pane.command.name} is not in the relaunch list)`);
  }
}

// Rebuild `ws` (a captured workspace) as a new workspace and return
// { workspaceId, actions: [{ action, detail }] }. A dry run changes nothing in
// herdr; placeholder ids stand in for what it would create.
export function rebuild(ws, { dryRun = false, log = () => {} } = {}) {
  const actions = [];
  const note = (action, detail) => {
    actions.push({ action, detail });
    log(`${action}  ${detail}`);
  };
  let counter = 0;
  const placeholder = (kind) => `<${kind}:${++counter}>`;
  const split = (id, options) => (dryRun ? placeholder('pane') : herdr.splitPane(id, options).pane_id);

  note('workspace.create', `"${ws.label || ''}" (${ws.cwd || 'default folder'})`);
  const created = dryRun ? null : herdr.createWorkspace({ cwd: ws.cwd, label: ws.label });
  const workspaceId = created ? created.workspace.workspace_id : placeholder('workspace');
  const context = { ws, created, workspaceId, dryRun, note, placeholder };

  const tabIds = [];
  const panesToFill = [];
  for (const [index, tab] of ws.tabs.entries()) {
    const { tabId, rootId } = openTab(context, tab, index);
    tabIds.push(tabId);
    const ids = layoutTab(rootId, tab.panes, split, note);
    panesToFill.push(...tab.panes.map((pane, position) => ({ id: ids[position], pane })));
  }

  // Fill panes once every tab exists, so the shells have had time to start.
  for (const { id, pane } of panesToFill) fillPane(context, id, pane);

  if (!dryRun) {
    const activeTab = tabIds[ws.active_tab || 0];
    if (activeTab) herdr.focusTab(activeTab);
    herdr.focusWorkspace(workspaceId);
  }
  return { workspaceId, actions };
}
