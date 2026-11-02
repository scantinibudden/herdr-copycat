# Changelog

All notable changes to herdr-copycat. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-02

First release: saved spaces as a plugin of their own.

### Added

- Save a workspace as a named space, open it as a new workspace, delete it: three actions with an fzf picker.
- Exact layout rebuild, nested splits included, at the saved sizes.
- Agents rejoin their conversation, using the resume flags from herdr's session restore table (18 agents). `"agents": "fresh"` starts them new instead.
- Programs on a user-editable relaunch list start again in their panes.
- `copycat` command line: `save`, `open --dry-run`, `list`, `delete`, `import`, `capture`.
- `import` brings over spaces saved by herdr-resurrect.

[0.1.0]: https://github.com/scantinibudden/herdr-copycat/releases/tag/v0.1.0
