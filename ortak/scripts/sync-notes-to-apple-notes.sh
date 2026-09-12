#!/usr/bin/env bash
#
# Copy the shared Ortak notes into Apple Notes on a Mac.
#
# iOS gives no app write access to Apple Notes, but macOS does — through
# AppleScript — so this is the one place the copy can be made automatically
# rather than through the share sheet. Notes are written into their own folder,
# so they never get mixed up with anything you wrote by hand.
#
# Usage:
#   export ORTAK_URL=https://ortak.example.com
#   export ORTAK_TOKEN=...            # from the phone that set the space up
#   ./sync-notes-to-apple-notes.sh [folder-name]
#
# On a schedule, e.g. every 30 minutes:
#   */30 * * * * ORTAK_URL=... ORTAK_TOKEN=... /path/to/sync-notes-to-apple-notes.sh
#
# One direction only: Ortak → Apple Notes. Editing the copy in Notes does not
# come back, and the next run overwrites it. Ortak stays the shared original.

set -euo pipefail

FOLDER="${1:-Ortak}"

if [[ -z "${ORTAK_URL:-}" || -z "${ORTAK_TOKEN:-}" ]]; then
  echo "Set ORTAK_URL and ORTAK_TOKEN first." >&2
  echo "  export ORTAK_URL=https://ortak.example.com" >&2
  echo "  export ORTAK_TOKEN=your-token" >&2
  exit 1
fi

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script only works on macOS — Apple Notes is scriptable there and nowhere else." >&2
  exit 1
fi

for tool in curl python3 osascript; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing required tool: $tool" >&2; exit 1; }
done

echo "Fetching notes from ${ORTAK_URL}…"

response="$(curl -fsS \
  -H "Authorization: Bearer ${ORTAK_TOKEN}" \
  "${ORTAK_URL}/api/sync?since=0&kinds=notes")" || {
  echo "Could not reach the server. Check ORTAK_URL and ORTAK_TOKEN." >&2
  exit 1
}

# Emit NUL-delimited (title, body) pairs. NUL is the one byte that cannot appear
# in the text itself, so titles and bodies containing newlines, quotes, emoji or
# backslashes survive intact.
extract_notes() {
  printf '%s' "$response" | python3 -c '
import json, sys

data = json.load(sys.stdin)
notes = data.get("changes", {}).get("notes", [])

for note in notes:
    if note.get("deleted"):
        continue
    title = (note.get("title") or "").strip() or "Untitled"
    body = note.get("body") or ""
    # Apple Notes renders its body as HTML, so escape the text and keep breaks.
    html = (
        body.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\n", "<br>")
    )
    sys.stdout.write(title + "\0" + html + "\0")
'
}

# The AppleScript takes its values as arguments rather than having them pasted
# into the source, so there is no quoting to get wrong.
APPLESCRIPT='
on run argv
  set folderName to item 1 of argv
  set noteTitle to item 2 of argv
  set noteBody to item 3 of argv

  tell application "Notes"
    if not (exists folder folderName) then
      make new folder with properties {name:folderName}
    end if

    tell folder folderName
      set matches to every note whose name is noteTitle
      if (count of matches) > 0 then
        set body of item 1 of matches to "<h1>" & noteTitle & "</h1>" & noteBody
        return "updated"
      else
        make new note with properties {name:noteTitle, body:"<h1>" & noteTitle & "</h1>" & noteBody}
        return "created"
      end if
    end tell
  end tell
end run
'

created=0
updated=0
failed=0

# Process substitution rather than a pipeline, so the counters below stay in
# this shell — and rather than "$(...)", which silently strips the NUL bytes the
# delimiting depends on.
while IFS= read -r -d '' title && IFS= read -r -d '' html; do
  if result="$(osascript -e "$APPLESCRIPT" "$FOLDER" "$title" "$html" 2>/dev/null)"; then
    case "$result" in
      created) created=$((created + 1)) ;;
      *) updated=$((updated + 1)) ;;
    esac
    echo "  ${result}: ${title}"
  else
    failed=$((failed + 1))
    echo "  ! failed: ${title}" >&2
  fi
done < <(extract_notes)

echo
echo "Done — ${created} created, ${updated} updated in the “${FOLDER}” folder in Notes."
if [[ "$failed" -gt 0 ]]; then
  echo "${failed} note(s) failed. The first run needs permission: System Settings →" >&2
  echo "Privacy & Security → Automation → allow your terminal to control Notes." >&2
  exit 1
fi
