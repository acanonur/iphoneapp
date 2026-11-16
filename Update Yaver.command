#!/bin/bash
# Double-click this file in the Finder to get the newest version of Yaver.
# If the server is running, stop it first (close its window).

# Everything is inside main(), and main is called on the last line: the
# download may replace this very file, and bash must have read all of it
# before that happens.
main() {
  cd "$(dirname "$0")" || exit 1
  # Where Node.js and XcodeGen usually live, in case this window does not know.
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

  echo
  echo "  1 of 3   Downloading the newest version…"
  echo
  # Installing packages can touch this file; the download brings its own copy.
  git checkout -- backend/package-lock.json 2>/dev/null
  git pull --ff-only ||
    fail "The download did not work. Check the internet connection and try again."

  echo
  echo "  2 of 3   Getting the server ready…"
  echo
  command -v node >/dev/null 2>&1 ||
    fail "Node.js is not installed yet. Download the LTS version from https://nodejs.org, install it, and double-click this file again."
  (cd backend && npm install --no-fund --no-audit) ||
    fail "The server's packages could not be installed. Check the internet connection and try again."

  echo
  echo "  3 of 3   Preparing the iPhone app…"
  echo
  command -v xcodegen >/dev/null 2>&1 ||
    fail "One tool is missing. Open the Terminal, type   brew install xcodegen   and press Enter. Then double-click this file again."
  (cd ios && ./generate.sh) || fail "The Xcode project could not be prepared."
  open ios/AISecretary.xcodeproj

  echo
  echo "  Done. Two things are left:"
  echo "    • In Xcode (it is opening now): choose your iPhone at the top and press the ▶ button."
  echo "    • Double-click \"Start Yaver.command\" to start the server."
  pause
}

pause() {
  echo
  read -r -p "Press Enter to close this window. " _
}

fail() {
  echo
  echo "  $1"
  pause
  exit 1
}

main "$@"; exit
