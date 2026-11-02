#!/usr/bin/env bash
# The overlay pane behind each action. It has a real TTY, so it can prompt.
#   usage: ui.sh <save|open|delete>
set -uo pipefail
mode="${1:?usage: ui.sh <save|open|delete>}"
root="${HERDR_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
copycat() { node "$root/bin/copycat.js" "$@"; }

die() {
  printf '%s\n' "$*" >&2
  printf 'Press any key to close…' >&2
  read -r -n1 _ 2>/dev/null || sleep 2
  exit 1
}

# Pick a saved space with fzf; prints its slug and display name on two lines.
pick() {
  command -v fzf >/dev/null 2>&1 || die "copycat: fzf is not installed or not on PATH."
  local lines choice
  lines="$(copycat list --picker 2>/dev/null)"
  [ -n "$lines" ] || die "copycat: no saved spaces yet. Save one first."
  choice="$(printf '%s\n' "$lines" | fzf --delimiter=$'\t' --with-nth=2 \
    --prompt="$1 ▸ " --header='↑↓ select · enter choose · esc cancel' \
    --reverse --cycle --no-multi --no-sort)" || return 1
  [ -n "$choice" ] || return 1
  printf '%s\n%s\n' "${choice%%$'\t'*}" "$(printf '%s' "${choice#*$'\t'}" | sed 's/  ·  .*//')"
}

case "$mode" in
  save)
    # launch.sh captured the workspace before this overlay opened.
    capture="${HERDR_COPYCAT_CAPTURE:-}"
    [ -n "$capture" ] && trap 'rm -f "$capture"' EXIT && trap 'exit 1' HUP TERM
    printf 'Save this workspace as: '
    IFS= read -r name || exit 0
    name="${name#"${name%%[![:space:]]*}"}"
    name="${name%"${name##*[![:space:]]}"}"
    [ -n "$name" ] || exit 0
    if [ -n "$capture" ] && [ -s "$capture" ]; then
      out="$(copycat save --from "$capture" --name "$name" 2>&1)" || die "$out"
    else
      out="$(copycat save --workspace "${HERDR_COPYCAT_ORIGIN_WS:-}" --name "$name" 2>&1)" || die "$out"
    fi
    printf '%s\n' "$out"
    sleep 0.7
    ;;
  open)
    sel="$(pick 'open space')" || exit 0
    out="$(copycat open --name "$(head -n1 <<<"$sel")" 2>&1)" || die "$out"
    printf '%s\n' "$(tail -n1 <<<"$out")"
    sleep 0.5
    ;;
  delete)
    sel="$(pick 'delete space')" || exit 0
    printf 'Delete saved space "%s"? [y/N] ' "$(tail -n1 <<<"$sel")"
    IFS= read -r ans || exit 0
    case "$ans" in
      y | Y | yes | YES) ;;
      *) printf 'Cancelled.\n'; sleep 0.4; exit 0 ;;
    esac
    out="$(copycat delete --name "$(head -n1 <<<"$sel")" 2>&1)" || die "$out"
    printf '%s\n' "$out"
    sleep 0.5
    ;;
  *) die "usage: ui.sh <save|open|delete>" ;;
esac
