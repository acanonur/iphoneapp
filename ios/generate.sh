#!/bin/sh
# Regenerates AISecretary.xcodeproj from project.yml.
#
# The project file is generated, so anything chosen inside Xcode — above all
# the signing team — would be lost each time. This script saves the team from
# the existing project into Config/Local.xcconfig first, where it survives.
#
# A generated project names no team of its own (it comes from Local.xcconfig),
# so a team found in the project file is one picked in Xcode since — say the
# paid developer account in place of the free "Personal Team". That choice
# wins over the one kept before.
set -e
cd "$(dirname "$0")"

LOCAL=Config/Local.xcconfig
PROJECT=AISecretary.xcodeproj/project.pbxproj

if [ -f "$PROJECT" ]; then
  TEAM=$(sed -n 's/.*DEVELOPMENT_TEAM = \([A-Z0-9]\{10\}\);.*/\1/p' "$PROJECT" | head -n 1)
  KEPT=$(sed -n 's/^DEVELOPMENT_TEAM = \([A-Z0-9]\{10\}\).*/\1/p' "$LOCAL" 2>/dev/null | head -n 1)
  if [ -n "$TEAM" ] && [ "$TEAM" != "$KEPT" ]; then
    # Keep whatever else the file holds; replace only the team.
    OTHER=$(grep -v '^DEVELOPMENT_TEAM' "$LOCAL" 2>/dev/null | grep -v '^// Your Apple developer team' || true)
    {
      printf '// Your Apple developer team, as last chosen in Xcode.\n'
      printf 'DEVELOPMENT_TEAM = %s\n' "$TEAM"
      if [ -n "$OTHER" ]; then printf '%s\n' "$OTHER"; fi
    } > "$LOCAL.new"
    mv "$LOCAL.new" "$LOCAL"
    if [ -n "$KEPT" ]; then
      echo "Your signing team is now $TEAM (chosen in Xcode), saved in $LOCAL"
    else
      echo "Kept your signing team ($TEAM) in $LOCAL"
    fi
  fi
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "XcodeGen is not installed. Install it with:  brew install xcodegen"
  exit 1
fi

xcodegen generate
echo "Done. Open AISecretary.xcodeproj in Xcode."
