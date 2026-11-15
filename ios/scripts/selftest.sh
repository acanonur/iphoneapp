#!/bin/sh
# Runs the app against a real server in the simulator, with nobody touching it,
# and fails if anything a person would do does not work: finding the server on
# the network, placing a call and following it line by line, hanging up, an
# answered call, paperwork, and a server that asks for its access key.
#
#   ios/scripts/selftest.sh <path to AISecretary.app> <backend folder> <output folder>
#
# The checks themselves are in ios/AISecretary/Support/SelfTest.swift; the app
# writes its verdicts to Documents/selftest.json, and this script reads them.
# The backend folder needs its packages installed (npm ci).
set -eu

APP="$1"
BACKEND="$2"
OUT="$3"
BUNDLE=com.canonur.aisecretary
WORK=$(mktemp -d)
FAILED=0
mkdir -p "$OUT"

. "$(dirname "$0")/simulator.sh"

SERVER_PID=""
stop_server() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  SERVER_PID=""
  pkill -f "src/index.ts" 2>/dev/null || true
  sleep 1
}
trap stop_server EXIT

# start_server <port> [NAME=value ...] — calls are simulated, at about three
# times their natural speed, so a whole call takes some ten seconds.
start_server() {
  port="$1"
  shift
  (
    cd "$BACKEND"
    exec env PORT="$port" DB_PATH="$WORK/db-$port/calls.db" MOCK_PACE=0.35 "$@" \
      ./node_modules/.bin/tsx src/index.ts
  ) > "$WORK/server-$port.log" 2>&1 &
  SERVER_PID=$!
  tries=0
  until curl -sf "http://127.0.0.1:$port/health" > /dev/null; do
    tries=$((tries + 1))
    if [ "$tries" -gt 60 ]; then
      echo "The server did not start:"
      cat "$WORK/server-$port.log"
      exit 1
    fi
    sleep 0.5
  done
  echo "Server on port $port: $(curl -s "http://127.0.0.1:$port/health")"
}

# run_plan <plan> <port> <seconds allowed> [launch arguments ...]
run_plan() {
  plan="$1"
  port="$2"
  limit="$3"
  shift 3
  # A fresh install: no saved address, nothing remembered.
  xcrun simctl uninstall "$UDID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl install "$UDID" "$APP"
  xcrun simctl launch "$UDID" "$BUNDLE" \
    -yaverSelfTest "$plan" \
    -AppleLanguages "(en)" -AppleLocale en_GB \
    -aisecretary.onboarded YES \
    -aisecretary.userName "Deniz Kaya" \
    -aisecretary.reportLanguage en \
    -aisecretary.callLanguage de \
    "$@" > /dev/null
  result="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data)/Documents/selftest.json"

  frame=0
  waited=0
  while [ "$waited" -lt "$limit" ]; do
    sleep 3
    waited=$((waited + 3))
    frame=$((frame + 1))
    picture="$OUT/$plan-$(printf %02d "$frame").png"
    xcrun simctl io "$UDID" screenshot "$picture" > /dev/null 2>&1 || true
    sips -Z 1748 "$picture" > /dev/null 2>&1 || true
    if [ -f "$result" ] && grep -q '"done":true' "$result"; then break; fi
  done
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true

  if [ -f "$result" ]; then cp "$result" "$OUT/$plan.json"; fi
  echo ""
  echo "=== SELF-TEST: $plan ==="
  if ! python3 - "$result" <<'PY'
import json, sys
try:
    report = json.load(open(sys.argv[1]))
except Exception as problem:
    print("  The app wrote no verdicts:", problem)
    sys.exit(1)
bad = 0
for check in report.get("checks", []):
    print("  %s  %s" % ("PASS" if check["ok"] else "FAIL", check["name"]))
    if check["detail"]:
        print("        " + check["detail"])
    bad += 0 if check["ok"] else 1
if not report.get("done"):
    print("  FAIL  the app did not finish in time")
    bad += 1
if not report.get("checks"):
    print("  FAIL  no checks were run")
    bad += 1
sys.exit(1 if bad else 0)
PY
  then
    FAILED=1
    echo "--- the server's last lines ---"
    tail -n 40 "$WORK/server-$port.log" | cut -c1-300
  fi
  echo "=== END ==="
}

# 1. A server on an unusual port, announced on the network. The app is given
#    no address: it has to find the server by itself. (The address passed along
#    is only used to carry on with the other checks if the search fails.)
start_server 8791
run_plan flow 8791 300 -yaverSelfTestAddress "http://127.0.0.1:8791"
stop_server

# 2. A server that insists on its access key.
KEY="selftest-$(date +%s)-key"
start_server 8792 REQUIRE_KEY=always API_KEY="$KEY" ADVERTISE=false
run_plan key 8792 90 -yaverSelfTestAddress "http://127.0.0.1:8792" -yaverSelfTestKey "$KEY"
stop_server

exit "$FAILED"
