// The saved-space library: one JSON file per space under SPACES_DIR. A space is a
// captured workspace (see capture.js) plus its display name and save time.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureWorkspace } from './capture.js';
import { rebuild } from './rebuild.js';
import { SPACES_DIR } from './paths.js';

const FORMAT = 1;

export const RESURRECT_SPACES = path.join(os.homedir(), '.local', 'state', 'herdr', 'plugins', 'ntindle.herdr-resurrect', 'spaces');

// A filesystem-safe stem for a display name. The display name itself is kept inside
// the file, so this only has to be safe and stable.
export function slugify(name = '') {
  const slug = String(name)
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, '-')
    .replaceAll(/^[-.]+|-+$/g, '')
    .replaceAll(/-{2,}/g, '-');
  return slug || 'space';
}

const fileFor = (slug) => path.join(SPACES_DIR, `${slug}.json`);

function writeSpace(file, space) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const partial = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(partial, `${JSON.stringify({ tool: 'herdr-copycat', format: FORMAT, ...space }, null, 2)}\n`);
  fs.renameSync(partial, file); // atomic: a reader never sees half a file
}

export function summarize(ws) {
  const summary = { tabs: 0, panes: 0, commands: 0, agents: 0 };
  const tabs = ws?.tabs || [];
  for (const tab of tabs) {
    summary.tabs++;
    const panes = tab.panes || [];
    for (const pane of panes) {
      summary.panes++;
      if (pane.agent) summary.agents++;
      else if (pane.command) summary.commands++;
    }
  }
  return summary;
}

// herdr-resurrect keeps a space's workspace in `workspaces[0]`, with tab ids.
function fromResurrect(record) {
  const [ws] = record.workspaces;
  const tabs = ws.tabs || [];
  return {
    label: ws.label || null,
    cwd: ws.cwd || null,
    active_tab: Math.max(0, tabs.findIndex((tab) => tab.tab_id === ws.active_tab_id)),
    tabs: tabs.map((tab) => ({ label: tab.label || null, panes: tab.panes || [] })),
  };
}

// Read a space file into { name, saved_at, workspace }. Also reads spaces saved by
// herdr-resurrect.
export function parse(text, fallbackName) {
  const record = JSON.parse(text);
  let workspace;
  if (record?.tool === 'herdr-copycat' && record.workspace) workspace = record.workspace;
  else if (record?.tool === 'herdr-resurrect' && record.kind === 'space' && record.workspaces?.[0]) workspace = fromResurrect(record);
  else throw new Error('not a herdr-copycat space');
  return { name: record.name || fallbackName, saved_at: record.saved_at || null, workspace };
}

// Save a workspace (default: the focused one) as a named space, or save a workspace
// captured earlier. Saving under an existing name replaces that space.
export function save(name, { workspaceId, workspace } = {}) {
  const displayName = String(name || '').trim();
  if (!displayName) throw new Error('a space name is required');
  const captured = workspace || captureWorkspace(workspaceId);
  const slug = slugify(displayName);
  const file = fileFor(slug);
  writeSpace(file, { name: displayName, saved_at: new Date().toISOString(), workspace: captured });
  return { name: displayName, slug, file, summary: summarize(captured) };
}

function spaceFiles(directory) {
  try {
    return fs.readdirSync(directory).filter((file) => file.endsWith('.json'));
  } catch {
    return [];
  }
}

// Saved spaces, newest first: [{ name, slug, file, saved_at, summary }].
export function list() {
  const spaces = spaceFiles(SPACES_DIR).map((fileName) => {
    const slug = fileName.slice(0, -'.json'.length);
    const file = path.join(SPACES_DIR, fileName);
    try {
      const space = parse(fs.readFileSync(file, 'utf8'), slug);
      return { name: space.name, slug, file, saved_at: space.saved_at, summary: summarize(space.workspace) };
    } catch {
      return { name: slug, slug, file, saved_at: null, summary: null };
    }
  });
  return spaces.toSorted((a, b) => String(b.saved_at || '').localeCompare(String(a.saved_at || '')));
}

// Find a space by slug or display name.
function resolve(nameOrSlug = '') {
  const wanted = String(nameOrSlug).trim();
  const direct = fileFor(slugify(wanted));
  if (fs.existsSync(direct)) return direct;
  const match = list().find((space) => space.name.toLowerCase() === wanted.toLowerCase());
  if (match) return match.file;
  throw new Error(`no saved space named "${wanted}"`);
}

export function load(nameOrSlug) {
  const file = resolve(nameOrSlug);
  return { file, ...parse(fs.readFileSync(file, 'utf8'), path.basename(file, '.json')) };
}

// Open a space as a brand-new workspace. Opening it twice gives two workspaces.
export function open(nameOrSlug, options = {}) {
  const space = load(nameOrSlug);
  return { name: space.name, file: space.file, ...rebuild(space.workspace, options) };
}

export function remove(nameOrSlug) {
  const space = load(nameOrSlug);
  fs.unlinkSync(space.file);
  return { name: space.name, file: space.file };
}

// Copy spaces saved by herdr-resurrect into the library. Copycat spaces with the
// same name are left alone. Returns { imported: [names], skipped: [names] }.
export function importResurrect(directory = RESURRECT_SPACES) {
  const outcome = { imported: [], skipped: [] };
  for (const fileName of spaceFiles(directory)) {
    let space;
    try {
      space = parse(fs.readFileSync(path.join(directory, fileName), 'utf8'), fileName.slice(0, -'.json'.length));
    } catch {
      continue; // not a space file
    }
    const file = fileFor(slugify(space.name));
    if (fs.existsSync(file)) {
      outcome.skipped.push(space.name);
      continue;
    }
    writeSpace(file, space);
    outcome.imported.push(space.name);
  }
  return outcome;
}
