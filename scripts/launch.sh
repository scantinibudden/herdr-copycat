#!/usr/bin/env bash
# Plugin actions run headless on the herdr server, so the interactive part (the name
# prompt, the fzf picker) lives in an overlay pane. This opens that overlay, passing
# on the workspace the action was invoked from.
#   usage: launch.sh <save|open|delete>
set -uo pipefail
mode="${1:?usage: launch.sh <save|open|delete>}"
herdr_bin="${HERDR_BIN_PATH:-herdr}"
plugin="${HERDR_PLUGIN_ID:-scantinibudden.herdr-copycat}"

ws="${HERDR_WORKSPACE_ID:-}"
cwd="${HERDR_WORKSPACE_CWD:-}"
ctx="${HERDR_PLUGIN_CONTEXT_JSON:-}"
if [ -n "$ctx" ] && command -v jq >/dev/null 2>&1; then
  [ -n "$ws" ] || ws="$(printf '%s' "$ctx" | jq -r '.workspace_id // empty' 2>/dev/null || true)"
  [ -n "$cwd" ] || cwd="$(printf '%s' "$ctx" | jq -r '.workspace_cwd // empty' 2>/dev/null || true)"
fi

set -- plugin pane open --plugin "$plugin" --entrypoint "$mode-ui" --placement overlay --focus
[ -n "$ws" ] && set -- "$@" --env "HERDR_COPYCAT_ORIGIN_WS=$ws"

# Capture the workspace now, before the overlay exists: herdr can lay an overlay
# out as a pane of the workspace, and it would end up in the saved space.
if [ "$mode" = save ]; then
  capture="$(mktemp "${TMPDIR:-/tmp}/copycat-capture.XXXXXX")" || exit 1
  if ! node "$(dirname "$0")/../bin/copycat.js" capture ${ws:+--workspace "$ws"} >"$capture"; then
    rm -f "$capture"
    exit 1
  fi
  set -- "$@" --env "HERDR_COPYCAT_CAPTURE=$capture"
fi
[ -n "$cwd" ] && [ -d "$cwd" ] && set -- "$@" --cwd "$cwd"
exec "$herdr_bin" "$@"
