#!/bin/sh
# Regenerates AISecretary.xcodeproj from project.yml.
#
# The project file is generated, so anything chosen inside Xcode — above all
# the signing team — would be lost each time. This script saves the team from
# the existing project into Config/Local.xcconfig first, where it survives.
set -e
cd "$(dirname "$0")"

LOCAL=Config/Local.xcconfig
PROJECT=AISecretary.xcodeproj/project.pbxproj

if [ ! -f "$LOCAL" ] && [ -f "$PROJECT" ]; then
  TEAM=$(sed -n 's/.*DEVELOPMENT_TEAM = \([A-Z0-9]\{10\}\);.*/\1/p' "$PROJECT" | head -n 1)
  if [ -n "$TEAM" ]; then
    printf '// Your Apple developer team, kept from the previous project.\nDEVELOPMENT_TEAM = %s\n' "$TEAM" > "$LOCAL"
    echo "Kept your signing team ($TEAM) in $LOCAL"
  fi
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "XcodeGen is not installed. Install it with:  brew install xcodegen"
  exit 1
fi

xcodegen generate
echo "Done. Open AISecretary.xcodeproj in Xcode."
