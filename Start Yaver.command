#!/bin/bash
# Double-click this file in the Finder to start the Yaver server.
# Keep the window that opens. To stop the server, close that window
# (or press Ctrl-C in it).

cd "$(dirname "$0")/backend" || exit 1
# Where Node.js usually lives, in case this window does not know.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

pause() { echo; read -r -p "Press Enter to close this window. " _; }

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Yaver needs Node.js, and it is not installed on this Mac yet."
  echo "  1. Open https://nodejs.org and download the version marked LTS."
  echo "  2. Install it (double-click the download and keep clicking Continue)."
  echo "  3. Double-click \"Start Yaver.command\" again."
  pause
  exit 1
fi

# The first time, and after every update: fetch what the server is built from.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo
  echo "  Getting the server ready (about a minute; only the first time and after an update)…"
  echo
  if ! npm install --no-fund --no-audit; then
    echo
    echo "  That did not work. Is this Mac connected to the internet? Then try again."
    pause
    exit 1
  fi
fi

npm start
pause
