#!/bin/bash
#
# Raycast script command: repair the clipboard in place.
# Add this folder in Raycast > Extensions > Script Commands, then give the
# command a hotkey (⌥⇧V is a good one - next to ⌘V, hard to hit by accident).
#
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Fix Clipboard
# @raycast.mode silent
#
# Optional parameters:
# @raycast.icon 📋
# @raycast.packageName clipfix
# @raycast.description Strip the glyph, gutter and line breaks a terminal agent added to the copied text.
# @raycast.author dave

export PATH="$HOME/.local/share/mise/shims:$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin"

CLIPFIX="$(cd "$(dirname "$0")/.." && pwd)/bin/clipfix.mjs"
[ -x "$CLIPFIX" ] || { echo "clipfix not found - is the volume mounted?"; exit 1; }

summary=$(node "$CLIPFIX" --clipboard "$@" 2>&1 >/dev/null) || { echo "$summary"; exit 1; }
echo "${summary#clipfix: }"
