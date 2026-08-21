#!/usr/bin/env bash
# Regenerate the Xcode project and open it.
#
# KnitStudio.xcodeproj is generated from project.yml and is deliberately not in
# git, so it lists whatever source files existed the last time it was made. Pull
# a commit that adds a file and Xcode will report the new types as "cannot find
# in scope" until the project is rebuilt. Running this after every pull avoids
# that entirely.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v xcodegen >/dev/null 2>&1; then
    echo "xcodegen is not installed. Run:  brew install xcodegen" >&2
    exit 1
fi

echo "Regenerating KnitStudio.xcodeproj…"
xcodegen generate
echo "Opening Xcode. Choose My Mac in the toolbar, then press Cmd-R."
open KnitStudio.xcodeproj
