#!/usr/bin/env node
// herdr-copycat command line. Run without arguments for usage.
import fs from 'node:fs';
import * as spaces from '../lib/spaces.js';
import { captureWorkspace } from '../lib/capture.js';

const USAGE = `usage: copycat <command> [arguments]
  save <name> [--workspace <id>]   save a workspace (default: this one) as a named space
  save <name> --from <file>        save a workspace captured earlier
  open <name> [--dry-run]          open a saved space as a new workspace
  list [--picker]                  list saved spaces (--picker: lines for fzf)
  delete <name>                    delete a saved space
  import [<directory>]             copy in spaces saved by herdr-resurrect
  capture [--workspace <id>]       print a workspace capture as JSON`;

const SWITCHES = new Set(['--dry-run', '--picker']);
const VALUE_FLAGS = new Set(['--workspace', '--name', '--from']);

function parseArguments(argv) {
  const flags = {};
  const words = [];
  for (let position = 0; position < argv.length; position++) {
    const word = argv[position];
    if (SWITCHES.has(word)) flags[word.slice(2)] = true;
    else if (VALUE_FLAGS.has(word)) flags[word.slice(2)] = argv[++position];
    else words.push(word);
  }
  return { flags, name: flags.name || words.join(' ') };
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function describe(summary) {
  if (!summary) return '(unreadable)';
  const { tabs, panes, agents, commands } = summary;
  return `${plural(tabs, 'tab')}, ${plural(panes, 'pane')} (${plural(agents, 'agent')}, ${plural(commands, 'program')})`;
}

function requireName(name) {
  if (!name) throw new Error('a space name is required');
  return name;
}

function listSpaces(picker) {
  const all = spaces.list();
  if (picker) {
    for (const space of all) process.stdout.write(`${space.slug}\t${space.name}  ·  ${describe(space.summary)}\n`);
  } else if (all.length === 0) {
    console.log('copycat: no saved spaces yet.');
  } else {
    for (const space of all) {
      const when = space.saved_at ? new Date(space.saved_at).toLocaleString() : 'unknown date';
      console.log(`${space.name}\n  ${describe(space.summary)}, saved ${when}`);
    }
  }
}

function main(argv) {
  const [command, ...rest] = argv;
  const { flags, name } = parseArguments(rest);
  const workspaceId = flags.workspace || process.env.HERDR_COPYCAT_ORIGIN_WS || process.env.HERDR_WORKSPACE_ID;

  switch (command) {
    case 'save': {
      const workspace = flags.from ? JSON.parse(fs.readFileSync(flags.from, 'utf8')) : undefined;
      const saved = spaces.save(name, { workspaceId, workspace });
      console.log(`copycat: saved "${saved.name}": ${describe(saved.summary)}`);
      break;
    }
    case 'open': {
      const isDryRun = Boolean(flags['dry-run']);
      const opened = spaces.open(requireName(name), { dryRun: isDryRun, log: (line) => console.log(`  ${line}`) });
      console.log(isDryRun ? `copycat: would open "${opened.name}" (dry run)` : `copycat: opened "${opened.name}"`);
      break;
    }
    case 'list': {
      listSpaces(Boolean(flags.picker));
      break;
    }
    case 'delete': {
      console.log(`copycat: deleted "${spaces.remove(requireName(name)).name}"`);
      break;
    }
    case 'import': {
      const { imported, skipped } = spaces.importResurrect(name || undefined);
      const note = skipped.length > 0 ? `; skipped ${skipped.length} that already exist (${skipped.join(', ')})` : '';
      console.log(`copycat: imported ${plural(imported.length, 'space')}${note}`);
      break;
    }
    case 'capture': {
      process.stdout.write(`${JSON.stringify(captureWorkspace(workspaceId))}\n`);
      break;
    }
    default: {
      console.error(USAGE);
      process.exitCode = 2;
    }
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`copycat: ${error.message}`);
  process.exitCode = 1;
}
