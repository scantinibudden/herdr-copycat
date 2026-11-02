# herdr-copycat

**Save any [herdr](https://herdr.dev) workspace as a named space, then open a copy of it whenever you like.**

Set up a workspace once: tabs, splits, folders, a couple of agents, nvim, a dev server. Save it as "api", and from then on one key gives you a fresh copy of that exact workspace, with everything started again.

```
┌─ api ──────────────────────────────────────────┐        ┌─ api ──────────────────────────────────────────┐
│ claude                  │ nvim src/            │  save  │ claude --resume …       │ nvim src/            │
│                         ├──────────────────────│  ───►  │                         ├──────────────────────│
│                         │ npm run dev          │  open  │                         │ npm run dev          │
└────────────────────────────────────────────────┘        └────────────────────────────────────────────────┘
```

## What a space keeps

| | |
|---|---|
| **Tabs** | in their on-screen order, with their names |
| **Splits** | the exact layout, nested splits included, at the same sizes |
| **Folders** | each pane's working directory |
| **Pane names** | any label you gave a pane |
| **Agents** | Claude Code, Codex, OpenCode and 15 others start again, rejoining their conversation |
| **Programs** | nvim, `tail -f`, dev servers… anything on your relaunch list |

Opening a space always creates a **new** workspace, so you can open the same space as often as you like.

## Install

Needs herdr 0.9 or newer, Node.js 22 or newer, and [fzf](https://github.com/junegunn/fzf) for the pickers. Linux and macOS.

```sh
herdr plugin install scantinibudden/herdr-copycat
```

Then bind keys in `~/.config/herdr/config.toml`:

```toml
[[keys.command]]
key = "prefix+S"
type = "shell"
command = "herdr plugin action invoke save --plugin scantinibudden.herdr-copycat"
description = "Copycat: save this workspace as…"

[[keys.command]]
key = "prefix+O"
type = "shell"
command = "herdr plugin action invoke open --plugin scantinibudden.herdr-copycat"
description = "Copycat: open saved space…"
```

The actions also appear in any command palette that lists plugin actions.

## Use

| Action | What happens |
|---|---|
| **Copycat: save this workspace as…** | asks for a name and saves the current workspace. Saving under an existing name replaces it. |
| **Copycat: open saved space…** | pick a space with fzf; it opens as a new workspace and gets focus. |
| **Copycat: delete saved space…** | pick a space, confirm, and it's gone. |

There's also a command line, handy for scripts. Run it from the plugin's folder (`herdr plugin list` shows where that is):

```sh
node bin/copycat.js list
node bin/copycat.js save "api" --workspace w3   # default: the workspace you're in
node bin/copycat.js open "api" --dry-run        # print the plan, change nothing
node bin/copycat.js delete "api"
```

## Settings

Settings live in the plugin's config folder (`herdr plugin config-dir scantinibudden.herdr-copycat`), created on first use.

**`settings.json`**

```json
{ "agents": "resume" }
```

- `"resume"` (default): agents rejoin the conversation they had when you saved.
- `"fresh"`: agents start a new conversation. Good for spaces you use as templates.

**`relaunch.txt`**: the programs copycat starts again, one name per line. It begins as a copy of [`config/relaunch.default.txt`](config/relaunch.default.txt) (editors, log viewers, monitors, dev servers). A program not on the list leaves a plain shell in its folder. A line with just `*` relaunches everything.

## Coming from herdr-resurrect

[herdr-resurrect](https://github.com/ntindle/herdr-resurrect) also has saved spaces. Copycat is that feature on its own, for people who want spaces without crash recovery, or alongside a different recovery plugin. It reads resurrect's spaces, so you can bring yours over:

```sh
node bin/copycat.js import
```

The two plugins don't conflict if you keep both.

## How it works

- **Saving** reads herdr's snapshot of the workspace and asks herdr what each pane is running. It captures before the name prompt opens, so the prompt never ends up in the space.
- **Opening** creates the workspace and its tabs, then rebuilds each tab's splits from the saved pane positions. herdr layouts are trees of single cuts, so the positions determine the tree exactly, nested splits included. Once every pane exists, it waits for each shell's prompt and types in the agent or program.
- Agents resume with the flags from herdr's own [session restore table](https://herdr.dev/docs).
- Spaces are plain JSON in the plugin's state folder, one file per space.

## Development

```sh
npm install
npm test        # node:test, against a fake herdr CLI
npm run lint    # strict ESLint (recommended + unicorn + n)
```

The tests never touch a real herdr. For a live check, run an isolated herdr with its own config and link your checkout into it:

```sh
export XDG_CONFIG_HOME=/run/user/$UID/copycat-dev XDG_STATE_HOME=/run/user/$UID/copycat-dev/state
herdr plugin link "$PWD" && herdr server
```

## Licence

[MIT](LICENSE) © Sebastian Cantini Budden
